/*
 * Public surface of the local QR engine.
 *
 * Two capabilities, both fully local and deterministic:
 *   - generate a standards-shaped symbol from UTF-8 text or a URL;
 *   - read a symbol back, either from a pasted matrix/SVG or from image pixels,
 *     with no platform barcode API involved.
 */

import { decodeQrMatrixValue, matrixFromRows, normalizeMatrixInput, type QrDecodeResult } from "./decode";
import { decodeQrFromRaster, QR_RASTER_MAX_PIXELS, QR_RASTER_VERSION, type RasterDecodeResult, type RasterPixels } from "./raster";
import { QR_ENCODER_VERSION, QR_QUIET_ZONE, generateQr, rasterPlan, renderQrSvg, type QrGenerateResult, type QrRasterPlan } from "./encode";
import { QR_BYTE_CAPACITY, QR_EC_LEVEL, QR_MAX_BYTES, QR_MAX_VERSION, QR_VERSION_SPECS } from "./spec";

export const QR_ENGINE_VERSION = `${QR_ENCODER_VERSION}+${QR_RASTER_VERSION}`;

export type { QrDecodeResult, QrGenerateResult, QrRasterPlan, RasterDecodeResult, RasterPixels };
export { QR_BYTE_CAPACITY, QR_EC_LEVEL, QR_MAX_BYTES, QR_MAX_VERSION, QR_QUIET_ZONE, QR_RASTER_MAX_PIXELS, QR_VERSION_SPECS };
export { decodeQrMatrixValue, decodeQrFromRaster, generateQr, matrixFromRows, normalizeMatrixInput, rasterPlan, renderQrSvg };
export { QR_EC_LEVEL as SUPPORTED_ERROR_CORRECTION };

export interface QrReadResult extends Omit<QrDecodeResult, "errorCorrection" | "mask" | "formatRepairDistance" | "mode"> {
  readonly source: "matrix" | "svg" | "rows" | "image";
  readonly errorCorrection: "L" | "M" | "Q" | "H";
  readonly mask: number | null;
  readonly formatRepairDistance: number | null;
  readonly mode: "byte" | "other";
  readonly moduleSizePixels?: number;
}

/**
 * Names the input the reader actually consumed, so the page can say where the
 * text came from instead of reporting a generic success.
 */
function asSource(value: unknown): QrReadResult["source"] {
  if (typeof value !== "string") return "matrix";
  const trimmed = value.trim();
  if (trimmed.includes("data-matrix=")) return "svg";
  if (trimmed.startsWith("[")) return "matrix";
  return trimmed.split(/\s+/u).filter((row) => row !== "").length > 1 ? "rows" : "matrix";
}

/** Reads a pasted matrix, JSON array, block of rows, or this tool's SVG. */
export function readQrMatrix(value: unknown): QrReadResult {
  const decoded = decodeQrMatrixValue(value);
  return { ...decoded, source: asSource(value) };
}

/**
 * Reads a symbol from image pixels. `pixels` must be RGBA in row-major order;
 * the browser component extracts them with a canvas, and tests build them from
 * a synthetic raster, so the decoding core itself has no DOM dependency.
 */
export function readQrPixels(pixels: RasterPixels): QrReadResult {
  const decoded = decodeQrFromRaster(pixels);
  if (decoded === null) throw new Error("QR_DECODE_FAILED");
  return { ...decoded, source: "image" };
}

/** True when this runtime can extract pixels for the image path at all. */
export function imagePathAvailable(): boolean {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

/**
 * Decodes an image element, canvas or bitmap to RGBA pixels with a canvas and
 * then reads the symbol. Exposed separately from the pixel reader so the
 * decoding core stays testable outside a browser.
 */
export async function readQrImage(source: ImageBitmap | HTMLImageElement | HTMLCanvasElement | Blob): Promise<QrReadResult> {
  const canvas = await pixelsFor(source);
  return readQrPixels(canvas);
}

export async function pixelsFor(source: ImageBitmap | HTMLImageElement | HTMLCanvasElement | Blob): Promise<RasterPixels> {
  if (!imagePathAvailable()) throw new Error("QR_IMAGE_DECODER_UNAVAILABLE");
  let width: number;
  let height: number;
  let drawable: CanvasImageSource;
  if (source instanceof Blob) {
    const bitmap = await decodeBlob(source);
    width = bitmap.width;
    height = bitmap.height;
    drawable = bitmap;
  } else if ("width" in source && "height" in source) {
    width = (source as HTMLImageElement).naturalWidth || (source as HTMLImageElement).width;
    height = (source as HTMLImageElement).naturalHeight || (source as HTMLImageElement).height;
    if (width === 0 || height === 0) throw new Error("QR_IMAGE_TOO_SMALL");
    drawable = source as CanvasImageSource;
  } else {
    throw new Error("QR_INVALID_INPUT");
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 21 || height < 21) throw new Error("QR_IMAGE_TOO_SMALL");
  if (width * height > QR_RASTER_MAX_PIXELS) throw new Error("QR_IMAGE_TOO_LARGE");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) throw new Error("QR_IMAGE_DECODER_UNAVAILABLE");
  context.drawImage(drawable, 0, 0);
  const imageData = context.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}

async function decodeBlob(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Fall through to the element path; some engines reject certain blobs
      // for the bitmap path but still decode them as an <img>.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "sync";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
