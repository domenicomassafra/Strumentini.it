import { inspectImageHeader } from "./format";
import { ImageVisualError, abortIfNeeded, assertDimension, assertPixels, canvasToBlob, decodeBitmap, type ImageVisualFile, type ImageVisualProgress } from "./visual";

export type OutputMime = "image/jpeg" | "image/png" | "image/webp";

export interface DecodedImage {
  readonly bitmap: ImageBitmap;
  readonly width: number;
  readonly height: number;
}

export interface ImageDataResult {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export function assertOutputMime(value: unknown): OutputMime {
  if (value !== "image/jpeg" && value !== "image/png" && value !== "image/webp") {
    throw new ImageVisualError("INVALID_INPUT", "Output format must be JPEG, PNG, or WebP");
  }
  return value;
}

export async function readHeader(file: ImageVisualFile, signal?: AbortSignal) {
  abortIfNeeded(signal);
  const bytes = new Uint8Array(await file.blob.slice(0, 2 * 1024 * 1024).arrayBuffer());
  abortIfNeeded(signal);
  try {
    return inspectImageHeader(bytes);
  } catch (error) {
    if (error instanceof ImageVisualError) throw error;
    throw new ImageVisualError("INVALID_IMAGE", "The selected file is not a supported image");
  }
}

export async function decodeImage(file: ImageVisualFile, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<DecodedImage> {
  progress?.({ phase: "decode", label: "Decoding locally" });
  const bitmap = await decodeBitmap(file.blob, signal);
  abortIfNeeded(signal);
  assertPixels(bitmap.width, bitmap.height);
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  assertDimension(width, "Width");
  assertDimension(height, "Height");
  assertPixels(width, height, "output");
  if (typeof document === "undefined") throw new ImageVisualError("UNSUPPORTED_BROWSER", "Canvas is unavailable");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) throw new ImageVisualError("UNSUPPORTED_BROWSER", "Canvas is unavailable");
  return context;
}

export function bitmapCanvas(bitmap: ImageBitmap, width = bitmap.width, height = bitmap.height): HTMLCanvasElement {
  const canvas = makeCanvas(width, height);
  const context = get2d(canvas);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

export async function imageDataFromBitmap(bitmap: ImageBitmap, signal?: AbortSignal): Promise<ImageDataResult> {
  abortIfNeeded(signal);
  const canvas = bitmapCanvas(bitmap);
  const context = get2d(canvas);
  const data = context.getImageData(0, 0, bitmap.width, bitmap.height);
  abortIfNeeded(signal);
  return { width: bitmap.width, height: bitmap.height, data: data.data };
}

export async function imageDataFromFile(file: ImageVisualFile, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ImageDataResult> {
  const decoded = await decodeImage(file, signal, progress);
  try {
    return await imageDataFromBitmap(decoded.bitmap, signal);
  } finally {
    decoded.bitmap.close();
  }
}

export async function encodeCanvas(canvas: HTMLCanvasElement, mime: OutputMime, quality: number | undefined, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<Blob> {
  abortIfNeeded(signal);
  progress?.({ phase: "encode", label: `Encoding ${mime.replace("image/", "").toUpperCase()}` });
  const blob = await canvasToBlob(canvas, mime, quality);
  abortIfNeeded(signal);
  return blob;
}

export function extensionForMime(mime: OutputMime): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

export function signatureMatches(bytes: Uint8Array, mime: OutputMime): boolean {
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
}

export async function verifyOutput(blob: Blob, mime: OutputMime, expectedWidth: number, expectedHeight: number, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<void> {
  abortIfNeeded(signal);
  progress?.({ phase: "verify", label: "Verifying output locally" });
  const header = inspectImageHeader(new Uint8Array(await blob.slice(0, 2 * 1024 * 1024).arrayBuffer()));
  if (header.mime !== mime) throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", `Output is ${header.mime}, expected ${mime}`);
  if (!signatureMatches(new Uint8Array(await blob.slice(0, 32).arrayBuffer()), mime)) throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Output signature does not match its format");
  if (header.width !== expectedWidth || header.height !== expectedHeight) throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", `Output is ${header.width}×${header.height}, expected ${expectedWidth}×${expectedHeight}`);
  const bitmap = await decodeBitmap(blob, signal);
  try {
    if (bitmap.width !== expectedWidth || bitmap.height !== expectedHeight) throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Decoded output dimensions do not match");
  } finally {
    bitmap.close();
  }
  abortIfNeeded(signal);
}

export async function outputBlob(
  canvas: HTMLCanvasElement,
  mime: OutputMime,
  quality: number | undefined,
  expectedWidth: number,
  expectedHeight: number,
  signal?: AbortSignal,
  progress?: (value: ImageVisualProgress) => void,
): Promise<Blob> {
  const blob = await encodeCanvas(canvas, mime, quality, signal, progress);
  await verifyOutput(blob, mime, expectedWidth, expectedHeight, signal, progress);
  return blob;
}

export function validateQuality(value: unknown, minimum = 0.1, maximum = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ImageVisualError("INVALID_INPUT", `Quality must be between ${minimum} and ${maximum}`);
  }
  return value;
}

export function validateObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) throw new ImageVisualError("INVALID_INPUT", "Input is required");
  return input as Record<string, unknown>;
}
