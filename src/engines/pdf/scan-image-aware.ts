import { extractPdfText, inspectPdfBytes } from "./index";
import { samePageContentBytes, samePageGeometry, topLevelPageImageIds } from "./jpeg-image-aware";
import { dictionaryOrNull, dictionaryWith, nameValue, numberValue, parsePdf, pdfName, pdfNumber, type PdfObject } from "./parser";
import { buildPdfFromPages, parseJpeg } from "./writer";
import { PDF_LIMITS, type PdfArtifact } from "./types";
import { pdfImageCompositingRisk218 } from "./image-aware-safety-218";

const MAX_CANDIDATES = 24;
const MAX_PIXELS = 8_000_000;
const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
const MIN_SAVINGS = 128;
const SAFE_KEYS = new Set(["Type", "Subtype", "Width", "Height", "ColorSpace", "BitsPerComponent", "Filter", "Length", "DecodeParms"]);
const SAFE_PREDICTOR_KEYS = new Set(["Predictor", "Colors", "Columns", "BitsPerComponent"]);

export interface PdfScanCompressionOptions {
  /** Lossy JPEG quality, 0.35..0.85. */
  readonly quality?: number;
  /** Explicit image-pixel downsample cap; not a claim about effective page DPI. */
  readonly maxLongestEdgePx?: number;
  /** Grayscale image pixels encoded into a DeviceRGB JPEG (three equal channels). */
  readonly grayscale?: boolean;
}

export interface PdfScanImageDecision {
  readonly sourceObject: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly outputWidth: number | null;
  readonly outputHeight: number | null;
  readonly beforeBytes: number;
  readonly afterBytes: number;
  readonly action: "recompressed" | "unchanged";
  readonly reason: string;
}

export interface PdfScanCompressionResult {
  readonly artifact: PdfArtifact;
  readonly analysis: {
    readonly profile: "scan-flate-to-jpeg";
    readonly quality: number;
    readonly maxLongestEdgePx: number;
    readonly grayscaleRequested: boolean;
    readonly grayscaleApplied: boolean;
    readonly downsampleApplied: boolean;
    readonly originalBytes: number;
    readonly outputBytes: number;
    readonly savedBytes: number;
    readonly recommendOriginal: boolean;
    readonly candidates: number;
    readonly touched: number;
    readonly skipped: number;
    readonly pageGeometryStable: true;
    readonly extractedTextStable: true;
    readonly originalPageContentStreamsPreserved: true;
    readonly visualParity: "not-verified-lossy";
    readonly warnings: readonly string[];
    readonly inventory: readonly PdfScanImageDecision[];
  };
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("PDF scan compression cancelled", "AbortError");
}

interface Raster { readonly pixels: Uint8Array; readonly width: number; readonly height: number; readonly channels: 1 | 3 }

/** Native streaming decompression, capped BEFORE allocation of complete raster bytes. */
async function inflateBounded(bytes: Uint8Array, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
  checkAbort(signal);
  if (typeof DecompressionStream === "undefined") throw new Error("UNSUPPORTED_CAPABILITY: Native Flate decompression unavailable");
  const reader = new Blob([Uint8Array.from(bytes)]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  // Expected dimensions bound this single decode buffer. The old approach
  // retained every decompressed chunk and allocated a second full copy at
  // completion, doubling peak live raster buffers on large scans.
  const decoded = new Uint8Array(maxBytes);
  let length = 0;
  const abortReader = () => { void reader.cancel("PDF scan cancelled").catch(() => undefined); };
  signal?.addEventListener("abort", abortReader, { once: true });
  try {
    while (true) {
      checkAbort(signal);
      const { done, value } = await reader.read();
      checkAbort(signal);
      if (done) break;
      if (value.length > maxBytes - length) {
        throw new Error("PDF_LIMIT: Flate image expanded beyond predicted raster dimensions");
      }
      decoded.set(value, length);
      length += value.length;
    }
  } finally {
    signal?.removeEventListener("abort", abortReader);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return decoded.subarray(0, length);
}

function eligibility(object: PdfObject, model: ReturnType<typeof parsePdf>): string | null {
  const stream = object.value;
  if (stream.kind !== "stream") return "not-image-stream";
  const dict = stream.dictionary.entries;
  if ([...dict.keys()].some((key) => !SAFE_KEYS.has(key))) return "complex-image-dictionary";
  if (nameValue(dict.get("Filter")) !== "FlateDecode") return "not-single-flatedecode";
  if (numberValue(dict.get("BitsPerComponent")) !== 8) return "not-8-bit-raster";
  const color = nameValue(dict.get("ColorSpace"));
  if (color !== "DeviceRGB" && color !== "DeviceGray") return "unsupported-color-space";
  const width = numberValue(dict.get("Width"));
  const height = numberValue(dict.get("Height"));
  if (width === null || height === null || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS) return "image-dimensions-over-limit";
  if (stream.bytes.length < 8 || stream.bytes.length > MAX_IMAGE_BYTES) return "compressed-raster-size-over-limit";
  const parms = dict.get("DecodeParms");
  if (parms !== undefined) {
    const decode = dictionaryOrNull(model, parms);
    if (decode === null || [...decode.entries.keys()].some((key) => !SAFE_PREDICTOR_KEYS.has(key))) return "unsupported-decode-parameters";
    const channels = color === "DeviceGray" ? 1 : 3;
    if ((numberValue(decode.entries.get("Colors")) ?? channels) !== channels ||
        (numberValue(decode.entries.get("Columns")) ?? width) !== width ||
        (numberValue(decode.entries.get("BitsPerComponent")) ?? 8) !== 8 ||
        ![1, 2, 10, 11, 12, 13, 14, 15].includes(numberValue(decode.entries.get("Predictor")) ?? 1)) {
      return "unsupported-png-predictor-parameters";
    }
  }
  return null;
}

/** Flate + TIFF/PNG row predictor; rejects mismatched rows instead of guessing pixels. */
async function decodeFlateRaster(object: PdfObject, model: ReturnType<typeof parsePdf>, signal?: AbortSignal): Promise<Raster> {
  const stream = object.value;
  if (stream.kind !== "stream") throw new Error("PDF_OUTPUT_MISMATCH: Expected a raster stream");
  const dict = stream.dictionary.entries;
  const width = numberValue(dict.get("Width"))!;
  const height = numberValue(dict.get("Height"))!;
  const channels = nameValue(dict.get("ColorSpace")) === "DeviceGray" ? 1 : 3;
  const predictor = numberValue(dictionaryOrNull(model, dict.get("DecodeParms"))?.entries.get("Predictor")) ?? 1;
  const rowLength = width * channels;
  const needsFilterByte = predictor >= 10;
  const expectedLength = height * (rowLength + (needsFilterByte ? 1 : 0));
  const decoded = await inflateBounded(stream.bytes, expectedLength, signal);
  if (decoded.byteLength !== expectedLength) {
    throw new Error("MALFORMED_PDF: Raster predictor row lengths disagree with dimensions");
  }
  if (predictor === 1) return { pixels: decoded, width, height, channels: channels as 1 | 3 };
  const pixels = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    const row = y * rowLength;
    const inputRow = y * (rowLength + (needsFilterByte ? 1 : 0));
    const filter = needsFilterByte ? decoded[inputRow]! : 1;
    if (filter > 4) throw new Error("MALFORMED_PDF: Unsupported PNG row filter");
    for (let x = 0; x < rowLength; x += 1) {
      const left = x >= channels ? pixels[row + x - channels]! : 0;
      const up = y > 0 ? pixels[row - rowLength + x]! : 0;
      const upLeft = y > 0 && x >= channels ? pixels[row - rowLength + x - channels]! : 0;
      const predict = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : (() => {
        const p = left + up - upLeft;
        const a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upLeft);
        return a <= b && a <= c ? left : b <= c ? up : upLeft;
      })();
      pixels[row + x] = (decoded[inputRow + x + (needsFilterByte ? 1 : 0)]! + predict) & 255;
    }
  }
  return { pixels, width, height, channels: channels as 1 | 3 };
}

async function encodeRaster(raster: Raster, quality: number, maxEdge: number, grayscale: boolean, signal?: AbortSignal): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (typeof document === "undefined") throw new Error("UNSUPPORTED_CAPABILITY: Local canvas JPEG encoder unavailable");
  checkAbort(signal);
  const canvas = document.createElement("canvas");
  let target: HTMLCanvasElement | undefined;
  try {
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (context === null) throw new Error("UNSUPPORTED_CAPABILITY: 2D canvas unavailable");
    const frame = context.createImageData(raster.width, raster.height);
    for (let i = 0; i < raster.width * raster.height; i += 1) {
      if ((i & 32767) === 0) checkAbort(signal);
      const offset = i * 4;
      const start = i * raster.channels;
      const r = raster.pixels[start]!;
      const g = raster.channels === 1 ? r : raster.pixels[start + 1]!;
      const b = raster.channels === 1 ? r : raster.pixels[start + 2]!;
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      frame.data[offset] = grayscale ? gray : r;
      frame.data[offset + 1] = grayscale ? gray : g;
      frame.data[offset + 2] = grayscale ? gray : b;
      frame.data[offset + 3] = 255;
    }
    context.putImageData(frame, 0, 0);
    const scale = Math.min(1, maxEdge / Math.max(raster.width, raster.height));
    const width = Math.max(1, Math.floor(raster.width * scale));
    const height = Math.max(1, Math.floor(raster.height * scale));
    target = scale < 1 ? document.createElement("canvas") : canvas;
    if (target !== canvas) {
      target.width = width;
      target.height = height;
      const targetContext = target.getContext("2d", { alpha: false });
      if (targetContext === null) throw new Error("UNSUPPORTED_CAPABILITY: Downsample canvas unavailable");
      targetContext.imageSmoothingEnabled = true;
      targetContext.imageSmoothingQuality = "high";
      targetContext.drawImage(canvas, 0, 0, width, height);
    }
    checkAbort(signal);
    const completedTarget = target;
    if (completedTarget === undefined) throw new Error("UNSUPPORTED_CAPABILITY: No JPEG target canvas");
    const blob = await new Promise<Blob>((resolve, reject) => completedTarget.toBlob((value) => {
      if (value === null || value.type !== "image/jpeg") reject(new Error("UNSUPPORTED_CAPABILITY: JPEG encoder returned no JPEG"));
      else resolve(value);
    }, "image/jpeg", quality));
    if (blob.size > MAX_IMAGE_BYTES) throw new Error("PDF_LIMIT: Encoded scan image exceeds byte cap");
    checkAbort(signal);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const parsed = parseJpeg(bytes);
    if (parsed?.width !== width || parsed.height !== height) throw new Error("PDF_OUTPUT_MISMATCH: Encoded scan image has wrong dimensions");
    return { bytes, width, height };
  } finally {
    // Resizing releases the previous pixel backing store. 1×1 is portable:
    // some native Canvas implementations reset 0×0 to the large 350×150 default.
    if (target && target !== canvas) target.width = target.height = 1;
    canvas.width = canvas.height = 1;
  }
}

/** Explicit opt-in lossy conversion for narrowly recognized lossless Flate raster scans. */
export async function recompressPdfScannedImages(source: Uint8Array, options: PdfScanCompressionOptions = {}, signal?: AbortSignal): Promise<PdfScanCompressionResult> {
  const quality = options.quality ?? 0.6;
  const maxLongestEdgePx = options.maxLongestEdgePx ?? 1600;
  const grayscale = options.grayscale ?? false;
  if (!Number.isFinite(quality) || quality < 0.35 || quality > 0.85 ||
      !Number.isInteger(maxLongestEdgePx) || maxLongestEdgePx < 256 || maxLongestEdgePx > 4096 || typeof grayscale !== "boolean") {
    throw new Error("INVALID_INPUT: Scan quality, grayscale or pixel edge limit is out of bounds");
  }
  if (!(source instanceof Uint8Array) || source.length < 8 || source.length > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: Invalid PDF input length");
  checkAbort(signal);
  const original = parsePdf(source.slice());
  if (original.encrypted || original.pages.length === 0) throw new Error("UNSUPPORTED_CAPABILITY: Encrypted or page-less PDF");
  const before = inspectPdfBytes(source);
  if (before.forms.length > 0 || before.pages.some((page) => page.annotationCount > 0)) {
    throw new Error("UNSUPPORTED_CAPABILITY: Scan PDFs with forms or annotations are not covered by preservation checks");
  }
  const model = parsePdf(source.slice());
  const candidates = [...model.objects.values()].filter((object) => object.value.kind === "stream" && nameValue(object.value.dictionary.entries.get("Subtype")) === "Image");
  if (candidates.length > PDF_LIMITS.maxImages) throw new Error("PDF_LIMIT: Too many images in scan PDF");
  const referenced = topLevelPageImageIds(model);
  const compositingRisk = pdfImageCompositingRisk218(model);
  const inventory: PdfScanImageDecision[] = [];
  let transformed = 0;
  for (const object of candidates) {
    checkAbort(signal);
    const stream = object.value;
    if (stream.kind !== "stream") continue;
    const width = numberValue(stream.dictionary.entries.get("Width"));
    const height = numberValue(stream.dictionary.entries.get("Height"));
    const base = { sourceObject: object.id, width, height, outputWidth: width, outputHeight: height, beforeBytes: stream.bytes.length, afterBytes: stream.bytes.length };
    const reason = compositingRisk ?? (inventory.length >= MAX_CANDIDATES ? "image-count-beyond-local-reencode-cap" :
      !referenced.has(object.id) ? "not-top-level-page-image-resource" : eligibility(object, model));
    if (reason !== null) {
      inventory.push({ ...base, action: "unchanged", reason });
      continue;
    }
    try {
      const raster = await decodeFlateRaster(object, model, signal);
      const encoded = await encodeRaster(raster, quality, maxLongestEdgePx, grayscale, signal);
      if (encoded.bytes.length + MIN_SAVINGS >= stream.bytes.length) {
        inventory.push({ ...base, action: "unchanged", reason: "scan-jpeg-not-meaningfully-smaller" });
        continue;
      }
      const dict = stream.dictionary;
      let replacement = dictionaryWith(dict, "Filter", pdfName("DCTDecode"));
      replacement = dictionaryWith(replacement, "ColorSpace", pdfName("DeviceRGB"));
      replacement = dictionaryWith(replacement, "Width", pdfNumber(encoded.width));
      replacement = dictionaryWith(replacement, "Height", pdfNumber(encoded.height));
      replacement = { ...replacement, entries: new Map([...replacement.entries].filter(([key]) => key !== "DecodeParms")) };
      object.value = { kind: "stream", dictionary: replacement, bytes: encoded.bytes };
      transformed += 1;
      inventory.push({ ...base, action: "recompressed", afterBytes: encoded.bytes.length,
        outputWidth: encoded.width, outputHeight: encoded.height, reason: "flate-raster-to-lossy-rgb-jpeg" });
    } catch (error) {
      checkAbort(signal);
      if (error instanceof Error && /^PDF_OUTPUT_MISMATCH|^PDF_LIMIT/u.test(error.message)) throw error;
      inventory.push({ ...base, action: "unchanged", reason: "flate-predictor-or-canvas-decoder-failed" });
    }
  }
  checkAbort(signal);
  const output = transformed === 0 ? source.slice() : buildPdfFromPages(model.pages.map((page) => ({ document: model, page })),
    { flatten: false, stripMetadata: false, compress: false });
  const after = inspectPdfBytes(output);
  const outputModel = parsePdf(output);
  const beforeText = await extractPdfText(source, signal);
  const afterText = await extractPdfText(output, signal);
  if (!samePageGeometry(before, after) || !samePageContentBytes(original, outputModel) ||
      before.images.length !== after.images.length || JSON.stringify(beforeText) !== JSON.stringify(afterText)) {
    throw new Error("PDF_OUTPUT_MISMATCH: Scan compression changed page geometry, original page streams, extracted text or image count");
  }
  checkAbort(signal);
  const grew = output.length >= source.length;
  const effective = transformed > 0 && !grew;
  const finalBytes = effective ? output : source.slice();
  const finalInventory = effective ? inventory : inventory.map((item) => item.action === "recompressed"
    ? { ...item, action: "unchanged" as const, afterBytes: item.beforeBytes, outputWidth: item.width, outputHeight: item.height,
      reason: grew ? "whole-pdf-result-not-smaller" : "no-effective-recompression" } : item);
  const touched = effective ? transformed : 0;
  const warnings = [
    ...(grew && transformed > 0 ? ["Il PDF ottimizzato sarebbe uguale o più grande: conservato l'originale."] : []),
    ...(candidates.length > touched ? ["Alcune immagini non erano idonee o non offrivano risparmio: consultare i motivi per oggetto."] : []),
  ];
  const artifactBytes = Uint8Array.from(finalBytes);
  return {
    artifact: { bytes: artifactBytes, blob: new Blob([artifactBytes], { type: "application/pdf" }), mime: "application/pdf",
      filename: effective ? "scan-image-aware.pdf" : "scan-original.pdf", pageCount: before.pageCount },
    analysis: { profile: "scan-flate-to-jpeg", quality, maxLongestEdgePx, grayscaleRequested: grayscale,
      grayscaleApplied: effective && grayscale, downsampleApplied: effective && finalInventory.some((item) => item.action === "recompressed" && item.outputWidth !== item.width),
      originalBytes: source.length, outputBytes: artifactBytes.length, savedBytes: source.length - artifactBytes.length,
      recommendOriginal: !effective, candidates: candidates.length, touched, skipped: candidates.length - touched,
      pageGeometryStable: true, extractedTextStable: true, originalPageContentStreamsPreserved: true,
      visualParity: "not-verified-lossy", warnings, inventory: finalInventory },
  };
}
