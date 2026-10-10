import { inspectPdfBytes, extractPdfText } from "./index";
import { dictionaryOrNull, nameValue, numberValue, parsePdf, resolveReference, type PdfDocumentModel, type PdfObject, type PdfValue } from "./parser";
import { buildPdfFromPages, parseJpeg } from "./writer";
import { PDF_LIMITS, type PdfArtifact, type PdfInspection } from "./types";
import { pdfImageCompositingRisk218 } from "./image-aware-safety-218";

const MAX_CANDIDATES = 24;
const MAX_DECODE_PIXELS = 8_000_000;
const MAX_JPEG_BYTES = 8 * 1024 * 1024;
const MIN_IMAGE_SAVINGS = 128;
const SAFE_JPEG_KEYS = new Set(["Type", "Subtype", "Width", "Height", "ColorSpace", "BitsPerComponent", "Filter", "Length"]);

export interface PdfJpegImageAwareOptions {
  /** Native browser JPEG encoder quality, inclusive 0.35..0.85. */
  readonly quality?: number;
}

export interface PdfJpegImageDecision {
  readonly sourceObject: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly beforeBytes: number;
  readonly afterBytes: number;
  readonly action: "recompressed" | "unchanged";
  readonly reason: string;
}

export interface PdfJpegImageAwareResult {
  readonly artifact: PdfArtifact;
  readonly analysis: {
    readonly profile: "jpeg-rgb-reencode";
    readonly quality: number;
    readonly originalBytes: number;
    readonly outputBytes: number;
    readonly savedBytes: number;
    readonly recommendOriginal: boolean;
    readonly candidates: number;
    readonly touched: number;
    readonly skipped: number;
    readonly downsampleApplied: false;
    readonly grayscaleApplied: false;
    readonly pngOrJbig2Applied: false;
    readonly pageGeometryStable: true;
    readonly extractedTextStable: true;
    readonly originalNonImageStreamsPreserved: true;
    /** Browser pixel equivalence is deliberately NOT asserted for lossy JPEG. */
    readonly visualParity: "not-verified-lossy";
    readonly inventory: readonly PdfJpegImageDecision[];
  };
}

function guard(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("PDF JPEG recompression cancelled", "AbortError");
}

/** Reject promptly even if a native browser codec promise never settles. */
function abortableCodec218<T>(pending: Promise<T>, signal?: AbortSignal, disposeLate?: (value: T) => void): Promise<T> {
  if (!signal) return pending;
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const onAbort = () => {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("PDF JPEG recompression cancelled", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    pending.then((value) => {
      if (finished) {
        disposeLate?.(value);
        return;
      }
      finished = true;
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    }, (error: unknown) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
    if (signal.aborted) onAbort();
  });
}

export function samePageGeometry(a: PdfInspection, b: PdfInspection): boolean {
  return a.pageCount === b.pageCount && a.pages.every((page, index) =>
    page.width === b.pages[index]?.width && page.height === b.pages[index]?.height && page.rotation === b.pages[index]?.rotation);
}

function safeCandidate(object: PdfObject): string | null {
  const value = object.value;
  if (value.kind !== "stream" || nameValue(value.dictionary.entries.get("Subtype")) !== "Image") return "not-image";
  const dictionary = value.dictionary.entries;
  if ([...dictionary.keys()].some((key) => !SAFE_JPEG_KEYS.has(key))) return "complex-image-dictionary";
  if (nameValue(dictionary.get("Filter")) !== "DCTDecode") return "not-single-dctdecode";
  if (nameValue(dictionary.get("ColorSpace")) !== "DeviceRGB" || numberValue(dictionary.get("BitsPerComponent")) !== 8) return "not-device-rgb-8bit";
  const width = numberValue(dictionary.get("Width"));
  const height = numberValue(dictionary.get("Height"));
  if (width === null || height === null || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_DECODE_PIXELS) return "dimensions-outside-bounded-rgb-decode";
  if (value.bytes.byteLength < 1024 || value.bytes.byteLength > MAX_JPEG_BYTES) return "jpeg-size-outside-bounded-reencode";
  const image = parseJpeg(value.bytes);
  if (image === null || image.width !== width || image.height !== height) return "jpeg-header-and-pdf-dimensions-disagree";
  if (jpegMetadataRequiresOriginal218(value.bytes)) return "jpeg-metadata-orientation-or-color-transform-not-certified";
  return null;
}

/**
 * A JPEG XObject is painted with PDF image semantics, not HTML <img> EXIF
 * auto-orientation. Browsers can apply orientation/profile/Adobe transforms
 * when createImageBitmap decodes the same bytes. Until we compare PDF-native
 * pixels against that browser decode, do not silently bake those transforms
 * into an opt-in lossy rewrite. Preserve the original stream instead.
 *
 * The marker walk is deliberately bounded to JPEG headers before SOS, never
 * scans entropy-coded image data for bytes that resemble APP markers, and
 * rejects malformed lengths rather than assuming metadata is absent.
 */
export function jpegMetadataRequiresOriginal218(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return true;
  let position = 2;
  while (position < bytes.length) {
    if (bytes[position++] !== 0xff) return true;
    while (bytes[position] === 0xff) position++;
    if (position >= bytes.length) return true;
    const marker = bytes[position++]!;
    if (marker === 0xda) return false; // Actual compressed pixels start here.
    if (marker === 0xd9) return true; // No scan data to transcode.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (position + 2 > bytes.length) return true;
    const segmentLength = (bytes[position]! << 8) | bytes[position + 1]!;
    if (segmentLength < 2 || position + segmentLength > bytes.length) return true;
    // APP0 JFIF is ordinary JPEG pixel metadata. APP1..APP15 may contain
    // EXIF orientation, XMP, ICC or Adobe color transforms; not certified.
    if (marker >= 0xe1 && marker <= 0xef) return true;
    position += segmentLength;
  }
  return true;
}

export function topLevelPageImageIds(documentModel: PdfDocumentModel): Set<number> {
  const referenced = new Set<number>();
  for (const page of documentModel.pages) {
    const value = page.object.value;
    if (value.kind !== "dict") continue;
    const resources = dictionaryOrNull(documentModel, value.entries.get("Resources") ?? page.inherited.Resources);
    const xobjects = dictionaryOrNull(documentModel, resources?.entries.get("XObject"));
    if (xobjects === null) continue;
    for (const candidate of xobjects.entries.values()) {
      if (candidate.kind !== "ref") continue;
      const object = documentModel.objects.get(candidate.id);
      if (object?.value.kind === "stream" && nameValue(object.value.dictionary.entries.get("Subtype")) === "Image") {
        referenced.add(candidate.id);
      }
    }
  }
  return referenced;
}

function pageContentStreams(model: PdfDocumentModel): readonly (readonly Uint8Array[])[] {
  function streamBytes(value: PdfValue | undefined): Uint8Array[] {
    if (value === undefined) return [];
    const resolved = resolveReference(model, value);
    if (resolved?.kind === "array") return resolved.items.flatMap(streamBytes);
    if (resolved?.kind !== "stream") throw new Error("PDF_OUTPUT_MISMATCH: Page /Contents cannot be verified");
    return [resolved.bytes];
  }
  return model.pages.map((page) => {
    const dictionary = page.object.value;
    return dictionary.kind === "dict" ? streamBytes(dictionary.entries.get("Contents")) : [];
  });
}

export function samePageContentBytes(a: PdfDocumentModel, b: PdfDocumentModel): boolean {
  const source = pageContentStreams(a);
  const output = pageContentStreams(b);
  return source.length === output.length && source.every((streams, pageIndex) => {
    const compared = output[pageIndex];
    return compared?.length === streams.length && streams.every((stream, streamIndex) => {
      const other = compared[streamIndex];
      return other !== undefined && stream.byteLength === other.byteLength && stream.every((byte, index) => byte === other[index]);
    });
  });
}

async function encodeRgbJpeg(bytes: Uint8Array, width: number, height: number, quality: number, signal?: AbortSignal): Promise<Uint8Array> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    throw new Error("UNSUPPORTED_CAPABILITY: Browser JPEG canvas decode/encode is unavailable.");
  }
  guard(signal);
  const bitmap = await abortableCodec218(createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: "image/jpeg" })),
    signal, (late) => late.close());
  const canvas = document.createElement("canvas");
  try {
    guard(signal);
    if (bitmap.width !== width || bitmap.height !== height) throw new Error("PDF_OUTPUT_MISMATCH: JPEG decoder changed image dimensions");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (context === null) throw new Error("UNSUPPORTED_CAPABILITY: Canvas 2D is unavailable");
    context.drawImage(bitmap, 0, 0);
    guard(signal);
    const encoded = await abortableCodec218(new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
      if (blob === null || blob.type !== "image/jpeg") reject(new Error("UNSUPPORTED_CAPABILITY: Browser JPEG encoder returned no JPEG"));
      else resolve(blob);
    }, "image/jpeg", quality)), signal);
    guard(signal);
    if (encoded.size > MAX_JPEG_BYTES) throw new Error("PDF_LIMIT: Encoder output exceeds JPEG cap");
    const output = new Uint8Array(await abortableCodec218(encoded.arrayBuffer(), signal));
    guard(signal);
    const parsed = parseJpeg(output);
    if (parsed?.width !== width || parsed.height !== height) throw new Error("PDF_OUTPUT_MISMATCH: Encoded JPEG did not preserve dimensions");
    return output;
  } finally {
    bitmap.close();
    canvas.width = canvas.height = 1;
  }
}

/**
 * Browser-only narrow opt-in encoder. Clones PDF source objects with original
 * content/vector streams intact, selectively replacing eligible JPEG XObjects.
 * Unhandled filters, masks, alpha, indexed/ICC/CMYK and inline images are skipped.
 *
 * Deliberately does not claim pixel-perfect output, text OCR, or all object-level
 * semantics for arbitrary PDFs. Caller must explicitly request this lossy mode.
 */
export async function recompressPdfEmbeddedJpegs(source: Uint8Array, options: PdfJpegImageAwareOptions = {}, signal?: AbortSignal): Promise<PdfJpegImageAwareResult> {
  const quality = options.quality ?? 0.6;
  if (!Number.isFinite(quality) || quality < 0.35 || quality > 0.85) throw new Error("INVALID_INPUT: JPEG quality must be between 0.35 and 0.85");
  if (!(source instanceof Uint8Array) || source.byteLength < 8 || source.byteLength > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: Invalid PDF input byte length");
  guard(signal);
  const model = parsePdf(source.slice());
  if (model.encrypted || model.pages.length === 0) throw new Error("UNSUPPORTED_CAPABILITY: Encrypted or page-less PDF cannot be image-recompressed");
  const before = inspectPdfBytes(source);
  // Page annotations/forms can carry drawing/appearance content whose handling
  // is outside the limited writer's tested fidelity guarantees.
  if (before.forms.length !== 0 || before.pages.some((page) => page.annotationCount > 0)) {
    throw new Error("UNSUPPORTED_CAPABILITY: PDFs containing forms or annotations require a separate preservation audit");
  }
  const imageObjects = [...model.objects.values()].filter((object) =>
    object.value.kind === "stream" && nameValue(object.value.dictionary.entries.get("Subtype")) === "Image");
  const referencedImageIds = topLevelPageImageIds(model);
  const compositingRisk = pdfImageCompositingRisk218(model);
  if (imageObjects.length > PDF_LIMITS.maxImages) throw new Error("PDF_LIMIT: Too many embedded image XObjects");
  const selected = imageObjects.slice(0, MAX_CANDIDATES);
  const replacements = new Map<number, Uint8Array>();
  const inventory: PdfJpegImageDecision[] = [];
  for (const object of selected) {
    guard(signal);
    const stream = object.value;
    if (stream.kind !== "stream") continue;
    const width = numberValue(stream.dictionary.entries.get("Width"));
    const height = numberValue(stream.dictionary.entries.get("Height"));
    const base = { sourceObject: object.id, width, height, beforeBytes: stream.bytes.byteLength };
    const reason = compositingRisk ?? (!referencedImageIds.has(object.id) ? "not-top-level-page-image-resource" : safeCandidate(object));
    if (reason !== null) {
      inventory.push({ ...base, afterBytes: stream.bytes.byteLength, action: "unchanged", reason });
      continue;
    }
    try {
      const jpeg = await encodeRgbJpeg(stream.bytes, width!, height!, quality, signal);
      if (jpeg.byteLength + MIN_IMAGE_SAVINGS >= stream.bytes.byteLength) {
        inventory.push({ ...base, afterBytes: stream.bytes.byteLength, action: "unchanged", reason: "encoded-jpeg-not-meaningfully-smaller" });
        continue;
      }
      replacements.set(object.id, jpeg);
      inventory.push({ ...base, afterBytes: jpeg.byteLength, action: "recompressed", reason: "rgb-jpeg-reencoded-at-source-dimensions" });
    } catch (error) {
      guard(signal);
      if (error instanceof Error && (/^PDF_OUTPUT_MISMATCH|^PDF_LIMIT/u.test(error.message))) throw error;
      inventory.push({ ...base, afterBytes: stream.bytes.byteLength, action: "unchanged", reason: "browser-decoder-or-encoder-failed" });
    }
  }
  for (const object of imageObjects.slice(MAX_CANDIDATES)) {
    const stream = object.value;
    if (stream.kind !== "stream") continue;
    inventory.push({ sourceObject: object.id, width: numberValue(stream.dictionary.entries.get("Width")),
      height: numberValue(stream.dictionary.entries.get("Height")), beforeBytes: stream.bytes.byteLength,
      afterBytes: stream.bytes.byteLength, action: "unchanged", reason: "image-count-beyond-local-reencode-cap" });
  }
  guard(signal);
  // No resize/downsample and no unrelated PDF structural optimizer pass here.
  const output = replacements.size === 0 ? source.slice() : buildPdfFromPages(model.pages.map((page) => ({ document: model, page })), {
    flatten: false, stripMetadata: false, compress: false, jpegReplacements: replacements,
  });
  guard(signal);
  const after = inspectPdfBytes(output);
  const outputModel = parsePdf(output);
  const contentBytesUnchanged = samePageContentBytes(model, outputModel);
  const sourceText = await extractPdfText(source, signal);
  const outputText = await extractPdfText(output, signal);
  const stableText = JSON.stringify(sourceText.map(({ page, text, truncated }) => ({ page, text, truncated }))) ===
    JSON.stringify(outputText.map(({ page, text, truncated }) => ({ page, text, truncated })));
  if (!samePageGeometry(before, after) || !stableText || !contentBytesUnchanged || before.images.length !== after.images.length) {
    throw new Error("PDF_OUTPUT_MISMATCH: Image reencode changed PDF geometry, page content bytes, extracted text or image count");
  }
  if (replacements.size > 0 && output.byteLength >= source.byteLength) {
    // Rebuilding PDFs can cost more than the JPEG savings. Return source with
    // truthful zero effective touches rather than a larger replacement PDF.
    return {
      artifact: { bytes: source.slice(), blob: new Blob([Uint8Array.from(source)], { type: "application/pdf" }), mime: "application/pdf", filename: "image-aware-original.pdf", pageCount: before.pageCount },
      analysis: { profile: "jpeg-rgb-reencode", quality, originalBytes: source.byteLength, outputBytes: source.byteLength,
        savedBytes: 0, recommendOriginal: true, candidates: imageObjects.length, touched: 0, skipped: imageObjects.length,
        downsampleApplied: false, grayscaleApplied: false, pngOrJbig2Applied: false, pageGeometryStable: true, extractedTextStable: true,
        originalNonImageStreamsPreserved: true, visualParity: "not-verified-lossy",
        inventory: inventory.map((item) => item.action === "recompressed" ? { ...item, afterBytes: item.beforeBytes, action: "unchanged" as const, reason: "whole-pdf-result-not-smaller" } : item),
      },
    };
  }
  const artifactBytes = Uint8Array.from(output);
  return {
    artifact: { bytes: artifactBytes, blob: new Blob([artifactBytes], { type: "application/pdf" }), mime: "application/pdf", filename: "image-aware-jpeg.pdf", pageCount: after.pageCount },
    analysis: { profile: "jpeg-rgb-reencode", quality, originalBytes: source.byteLength, outputBytes: output.byteLength,
      savedBytes: source.byteLength - output.byteLength, recommendOriginal: replacements.size === 0,
      candidates: imageObjects.length, touched: replacements.size, skipped: imageObjects.length - replacements.size,
      downsampleApplied: false, grayscaleApplied: false, pngOrJbig2Applied: false, pageGeometryStable: true, extractedTextStable: true,
      originalNonImageStreamsPreserved: true, visualParity: "not-verified-lossy", inventory,
    },
  };
}
