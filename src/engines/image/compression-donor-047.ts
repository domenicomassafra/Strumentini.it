/**
 * #047 donor-first, isolated browser-only image compression.
 *
 * Actual installed donors: `fflate` (MIT, streamed zlib PNG engine in
 * png-lossless-47.ts and bounded exact/lossy palette encoder in
 * png-palette-lossy-47.ts) and browser native Canvas JPEG/WebP encoders
 * (browser platform APIs, not MozJPEG/libwebp expert or lossless-encoder promises).
 * `sharp` (Apache-2.0/native libvips) is used by tests for independent output
 * reopening, NEVER shipped as a client codec. @jsquash, pngquant and oxipng
 * WASM codecs are not installed, so those paths MUST remain unavailable.
 *
 * This adapter is not connected to an existing public output UI. It must not
 * claim JPEG chroma subsampling, progressive JPEG, WebP exact effort/lossless
 * or original metadata/ICC preservation, since Canvas exposes none of those.
 */
import { inspectImageHeader, type SupportedImageMime } from "./format";

export const DONOR_47_CAPABILITIES = Object.freeze({
  pngLossless: { supported: true, codec: "fflate", alpha: "byte-exact", note: "verified original scanlines/palette/tRNS/metadata" },
  jpegLossy: { supported: true, codec: "browser-canvas", alpha: "refuse-transparent", note: "normal/compact quality hints; browser owns encoding specifics" },
  webpLossy: { supported: true, codec: "browser-canvas", alpha: "verify-decoded-exact", note: "VP8 lossy subtype and exact decoded alpha verification, no effort control" },
  pngPaletteExact: { supported: true, codec: "fflate", alpha: "byte-exact", note: "8-bit RGB/RGBA with <=256 colors, metadata gate, strict indexed PNG reparse" },
  pngPaletteLossy: { supported: true, codec: "fflate", alpha: "byte-exact", note: "8-bit RGB/RGBA quantized RGB <=32 channel error; exact alpha; 4 or fewer alpha levels" },
  webpLossless: { supported: false, reason: "Canvas has no portable WebP lossless/effort API; no @jsquash/webp WASM installed." },
  jpegNativeExpert: { supported: false, reason: "Canvas does not expose quantization tables, progressive, chroma sampling or MozJPEG; no WASM donor installed." },
});

export type DonorMode47 = "png-lossless" | "png-palette-exact" | "png-palette-lossy" | "jpeg-normal" | "jpeg-compact" | "webp-lossy";
export interface DonorOptions47 {
  readonly mode: DonorMode47;
  /** Browser quality *hint*, not quantizer/expert/effort guarantee. */
  readonly qualityHint?: number;
  readonly signal?: AbortSignal;
}
export interface DonorResult47 {
  readonly blob: Blob;
  readonly mode: DonorMode47;
  readonly inputMime: SupportedImageMime;
  readonly outputMime: SupportedImageMime;
  readonly width: number;
  readonly height: number;
  readonly originalBytes: number;
  readonly outputBytes: number;
  readonly savedBytes: number;
  readonly savedPercent: number;
  readonly keptOriginal: boolean;
  readonly codec: "fflate" | "browser-canvas";
  readonly encoderQualityHint: number | null;
  readonly verification: "exact-filtered-scanlines" | "strict-png-reparse-and-alpha" | "independent-browser-redecode-and-alpha";
  readonly alphaPolicy: "exact" | "no-alpha";
  readonly paletteColors?: number;
  readonly pixelPolicy?: "exact" | "lossy-rgb" | "original-unmodified";
  readonly maxObservedChannelError?: number;
  readonly caveats: readonly string[];
}

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 1_000_000;
const MAX_DIMENSION = 4096;

function error(code: string, why: string): never {
  throw new Error(`IMAGE_DONOR_47_${code}: ${why}`);
}
function check(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Image compression cancelled", "AbortError");
}
function compareMime(type: string, actual: SupportedImageMime): void {
  if (type !== "" && type !== actual) error("TYPE_MISMATCH", `Declared MIME ${type} differs from binary header ${actual}`);
}
function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  return offset >= 0 && offset + text.length <= bytes.length
    && [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
}
/** Reject animation instead of silently exporting the first frame. */
function rejectAnimation(bytes: Uint8Array, mime: SupportedImageMime): void {
  if (mime === "image/png") {
    for (let at = 8; at + 12 <= bytes.length;) {
      const size = new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0, false);
      if (size > bytes.length - at - 12) error("INVALID_INPUT", "Truncated PNG chunk");
      if (ascii(bytes, at + 4, "acTL")) error("ANIMATION_UNSUPPORTED", "APNG must not silently lose frames");
      at += size + 12;
      if (ascii(bytes, at - size - 8, "IEND")) break;
    }
  }
  if (mime === "image/webp") {
    if (bytes.length < 20 || !ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WEBP")) error("INVALID_INPUT", "WebP RIFF header invalid");
    const length = new DataView(bytes.buffer, bytes.byteOffset, 12).getUint32(4, true) + 8;
    if (length !== bytes.length) error("INVALID_INPUT", "WebP RIFF size inconsistent");
    let hasImageBitstream = false;
    for (let at = 12; at + 8 <= length;) {
      const lengthChunk = new DataView(bytes.buffer, bytes.byteOffset + at, 8).getUint32(4, true);
      if (lengthChunk > length - at - 8) error("INVALID_INPUT", "WebP chunk truncated");
      // RIFF requires a present, zero-valued padding byte for odd chunks.
      if ((lengthChunk & 1) !== 0 && bytes[at + 8 + lengthChunk] !== 0) error("INVALID_INPUT", "WebP chunk padding missing or nonzero");
      // A still WebP contains exactly one VP8/VP8L image bitstream. Native
      // decoders may silently ignore an extra one, so decoding alone cannot
      // establish that retaining the original bytes is safe.
      if (ascii(bytes, at, "VP8 ") || ascii(bytes, at, "VP8L")) {
        if (hasImageBitstream) error("INVALID_INPUT", "WebP contains multiple image bitstreams");
        hasImageBitstream = true;
      }
      if (ascii(bytes, at, "ANIM") || ascii(bytes, at, "ANMF") ||
        (ascii(bytes, at, "VP8X") && lengthChunk >= 1 && ((bytes[at + 8]! & 0x02) !== 0))) {
        error("ANIMATION_UNSUPPORTED", "Animated WebP must not be reduced to a still image");
      }
      at += 8 + lengthChunk + (lengthChunk & 1);
    }
  }
}

function quality(options: DonorOptions47): number {
  const fallback = options.mode === "jpeg-compact" ? 0.55 : options.mode === "jpeg-normal" ? 0.84 : 0.78;
  if (options.qualityHint === undefined) return fallback;
  if (!Number.isFinite(options.qualityHint) || options.qualityHint < 0.1 || options.qualityHint > 1) {
    error("INVALID_QUALITY", "Browser quality hint must be between 0.1 and 1");
  }
  return options.qualityHint;
}

function blobFromCanvas(canvas: HTMLCanvasElement, mime: SupportedImageMime, hint: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.size === 0) reject(new Error("IMAGE_DONOR_47_ENCODER_UNAVAILABLE: browser rejected encoder"));
      else resolve(blob);
    }, mime, hint);
  });
}

function decodedImage(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") error("BROWSER_UNAVAILABLE", "Browser ImageBitmap decoder required");
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

function imagePixels(bitmap: ImageBitmap): Uint8ClampedArray {
  if (typeof document === "undefined") error("BROWSER_UNAVAILABLE", "DOM canvas required");
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) error("BROWSER_UNAVAILABLE", "2D canvas readback unavailable");
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
}

/** Verify VP8 image chunk, not VP8L, for a claimed WebP lossy result. */
function isWebpLossy(bytes: Uint8Array): boolean {
  if (!ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WEBP")) return false;
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8;
  if (length !== bytes.length) return false;
  for (let at = 12; at + 8 <= bytes.length;) {
    const n = new DataView(bytes.buffer, bytes.byteOffset + at, 8).getUint32(4, true);
    if (n > bytes.length - at - 8) return false;
    if (ascii(bytes, at, "VP8L")) return false;
    if (ascii(bytes, at, "VP8 ")) return true;
    at += 8 + n + (n & 1);
  }
  return false;
}

/** No uploads or server codec; all binary work executes in the caller's browser. */
export async function compressImageWithDonor47(input: Blob, options: DonorOptions47): Promise<DonorResult47> {
  check(options?.signal);
  if (!options || !(["png-lossless", "png-palette-exact", "png-palette-lossy", "jpeg-normal", "jpeg-compact", "webp-lossy"] as string[]).includes(options.mode)) {
    error("UNSUPPORTED_MODE", "No portable WebP lossless or JPEG expert codec donor installed");
  }
  if (!(input instanceof Blob) || input.size < 30 || input.size > MAX_BYTES) error("INVALID_INPUT", "Nonempty image <=4 MiB required");
  const headerBytes = new Uint8Array(await input.arrayBuffer());
  check(options.signal);
  let header: ReturnType<typeof inspectImageHeader>;
  try { header = inspectImageHeader(headerBytes); }
  catch { error("INVALID_INPUT", "Raster header is invalid or unsupported"); }
  compareMime(input.type, header.mime);
  if (header.width > MAX_DIMENSION || header.height > MAX_DIMENSION || header.width * header.height > MAX_PIXELS) {
    error("PIXEL_LIMIT", "Image exceeds 4096px dimension / 1MP canvas budget");
  }
  rejectAnimation(headerBytes, header.mime);

  if (options.mode === "png-lossless") {
    if (header.mime !== "image/png") error("MODE_MISMATCH", "Lossless IDAT mode requires a PNG input");
    if (options.qualityHint !== undefined) error("INVALID_QUALITY", "PNG lossless has no quality hint");
    const { compressPngLossless47 } = await import("./png-lossless-47"); // genuinely lazy fflate dependency
    check(options.signal);
    const result = await compressPngLossless47(input, options.signal);
    return { blob: result.blob, mode: options.mode, inputMime: header.mime, outputMime: "image/png",
      width: result.width, height: result.height, originalBytes: result.originalBytes, outputBytes: result.outputBytes,
      savedBytes: result.savedBytes, savedPercent: result.savedPercent, keptOriginal: result.keptOriginal,
      codec: "fflate", encoderQualityHint: null, verification: "exact-filtered-scanlines", alphaPolicy: "exact",
      caveats: [result.note] };
  }

  if (options.mode === "png-palette-exact" || options.mode === "png-palette-lossy") {
    if (header.mime !== "image/png") error("MODE_MISMATCH", "PNG palette requires a PNG input");
    if (options.qualityHint !== undefined) error("INVALID_QUALITY", "PNG palette uses exact or bounded RGB quantization, not a browser quality hint");
    // Reuse the already verified public PNG palette codec; load it only for
    // explicitly selected modes, without pulling the encoder into JPEG/WebP.
    const { quantizePngPalette47 } = await import("./png-palette-lossy-47");
    check(options.signal);
    const result = await quantizePngPalette47(input, {
      mode: options.mode === "png-palette-exact" ? "exact" : "lossy",
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    check(options.signal);
    return {
      blob: result.blob, mode: options.mode, inputMime: "image/png", outputMime: "image/png",
      width: result.width, height: result.height,
      originalBytes: result.originalBytes, outputBytes: result.outputBytes,
      savedBytes: result.savedBytes, savedPercent: result.savedPercent, keptOriginal: result.keptOriginal,
      codec: "fflate", encoderQualityHint: null,
      verification: "strict-png-reparse-and-alpha", alphaPolicy: "exact",
      paletteColors: result.paletteColors, pixelPolicy: result.pixelPolicy,
      maxObservedChannelError: result.maxObservedChannelError,
      caveats: [result.note],
    };
  }

  if (typeof document === "undefined") error("BROWSER_UNAVAILABLE", "JPEG and WebP modes require browser Canvas and ImageBitmap");
  const hint = quality(options);
  let bitmap: ImageBitmap;
  try { bitmap = await decodedImage(input); }
  catch { error("DECODE_FAILED", "Browser decoder could not reopen image"); }
  try {
    check(options.signal);
    if (bitmap.width !== header.width || bitmap.height !== header.height) error("DIMENSION_MISMATCH", "Decoded dimensions contradict header");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) error("BROWSER_UNAVAILABLE", "2D Canvas not supported");
    context.drawImage(bitmap, 0, 0);
    const sourcePixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasTransparency = sourcePixels.some((alpha, index) => index % 4 === 3 && alpha !== 255);
    const outputMime = options.mode.startsWith("jpeg-") ? "image/jpeg" : "image/webp";
    if (outputMime === "image/jpeg" && hasTransparency) error("ALPHA_UNSUPPORTED", "JPEG has no alpha channel: refuse silent flattening");
    const candidate = await blobFromCanvas(canvas, outputMime, hint);
    check(options.signal);
    if (candidate.size > MAX_BYTES * 2) error("OUTPUT_LIMIT", "Encoded output larger than 8 MiB");
    const candidateBytes = new Uint8Array(await candidate.arrayBuffer());
    check(options.signal);
    let candidateHeader: ReturnType<typeof inspectImageHeader>;
    try { candidateHeader = inspectImageHeader(candidateBytes); }
    catch { error("OUTPUT_VERIFICATION", "Browser produced undecodable or unrecognized format"); }
    if (candidateHeader.mime !== outputMime || candidateHeader.width !== header.width || candidateHeader.height !== header.height) {
      error("OUTPUT_VERIFICATION", "Encoder MIME fallback or dimension mismatch");
    }
    if (outputMime === "image/webp" && !isWebpLossy(candidateBytes)) {
      error("OUTPUT_VERIFICATION", "WebP bitstream not provably VP8 lossy; cannot claim requested mode");
    }
    let checked: ImageBitmap;
    try { checked = await decodedImage(candidate); }
    catch { error("OUTPUT_VERIFICATION", "Encoder output could not be reopened by browser"); }
    try {
      check(options.signal);
      if (checked.width !== header.width || checked.height !== header.height) error("OUTPUT_VERIFICATION", "Reopened output dimension mismatch");
      const outputPixels = imagePixels(checked);
      // Alpha exactness is non-negotiable; for opaque images all pixels must stay opaque.
      for (let i = 3; i < sourcePixels.length; i += 4) {
        if (sourcePixels[i] !== outputPixels[i]) error("ALPHA_CHANGED", "Encoded image changed alpha channel");
      }
    } finally { checked.close(); }

    // An equal-MIME WebP file is not necessarily the requested lossy VP8
    // subtype. Retaining a smaller VP8L source would falsely claim this run
    // produced WebP lossy (and honored its quality hint). If the verified VP8
    // candidate is larger, return it with *negative* actual savings instead.
    const originalMatchesMode = outputMime !== "image/webp" || isWebpLossy(headerBytes);
    const keptOriginal = header.mime === outputMime && originalMatchesMode && input.size <= candidate.size;
    const blob = keptOriginal ? input : candidate;
    const savedBytes = input.size - blob.size;
    return {
      blob, mode: options.mode, inputMime: header.mime, outputMime,
      width: header.width, height: header.height,
      originalBytes: input.size, outputBytes: blob.size, savedBytes,
      savedPercent: Number((savedBytes / input.size * 100).toFixed(2)), keptOriginal,
      codec: "browser-canvas", encoderQualityHint: hint,
      verification: "independent-browser-redecode-and-alpha", alphaPolicy: hasTransparency ? "exact" : "no-alpha",
      caveats: ["Native Canvas lossy encoder: quality is a browser-dependent hint, not a portable bitrate, quantizer, JPEG subsampling/progressive or WebP effort setting.",
        "RGBA color samples can change in lossy mode; decoded alpha values are independently checked exactly.",
        "Canvas re-encoding may drop EXIF/GPS/ICC/metadata and change color interpretation. Never label it metadata-preserving.",
        "A format conversion can produce an output larger than the source; savings are signed actual bytes, never estimated."],
    };
  } finally { bitmap.close(); }
}
