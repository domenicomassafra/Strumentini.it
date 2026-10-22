import { outputBlob, readHeader } from "./operations";
import {
  applyImageTransformPixels,
  defaultImageTransformState,
  pixelFrameToCanvas,
  readImageTransformSource,
  type PixelFrame,
} from "./transform-workspace";
import { abortIfNeeded, assertFile, ImageVisualError, normalizeName, type ImageVisualProgress } from "./visual";

// 4 MP limits the two intermediate RGBA frames and optional coverage to a bounded working set.
// This is a conservative software guard, not an empirically verified mobile RAM budget (#124).
export const SELECTION_MAX_PIXELS_382 = 4_000_000;
export type SelectionMode382 = "crop" | "mask";
export type SelectionShape382 = "rectangle" | "ellipse";
export interface ImageSelection382 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly shape: SelectionShape382;
  /** Optional local grayscale selection coverage, in row-major selection coordinates. */
  readonly coverage?: Uint8ClampedArray;
}

export interface SelectionPoint382 { readonly x: number; readonly y: number }
export interface CanvasBounds382 { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

function sourceDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192) {
    throw new ImageVisualError("INVALID_INPUT", "Source dimensions must be positive bounded integers");
  }
  if (width * height > SELECTION_MAX_PIXELS_382) throw new ImageVisualError("PIXEL_LIMIT", "Selection exceeds conservative 4 MP local budget");
}

function validateSelection(selection: ImageSelection382, width: number, height: number): void {
  if (!selection || (selection.shape !== "rectangle" && selection.shape !== "ellipse")) {
    throw new ImageVisualError("INVALID_INPUT", "Selection shape must be rectangle or ellipse");
  }
  if (![selection.x, selection.y, selection.width, selection.height].every(Number.isSafeInteger) ||
    selection.x < 0 || selection.y < 0 || selection.width < 1 || selection.height < 1 ||
    selection.x + selection.width > width || selection.y + selection.height > height) {
    throw new ImageVisualError("INVALID_INPUT", "Selection must occupy an exact in-bounds pixel rectangle");
  }
  if (selection.coverage !== undefined &&
    (!(selection.coverage instanceof Uint8ClampedArray) || selection.coverage.length !== selection.width * selection.height)) {
    throw new ImageVisualError("INVALID_INPUT", "Selection coverage must match pixel dimensions");
  }
}

function pointInSource(point: SelectionPoint382, width: number, height: number): void {
  if (!point || !Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y) ||
      point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
    throw new ImageVisualError("INVALID_INPUT", "Pixel point falls outside the decoded image");
  }
}

export function pointerPixel382(clientX: number, clientY: number, bounds: CanvasBounds382, width: number, height: number): SelectionPoint382 {
  sourceDimensions(width, height);
  if (![clientX, clientY, bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
    throw new ImageVisualError("INVALID_INPUT", "Pointer coordinates require finite, positive canvas bounds");
  }
  return {
    x: Math.min(width - 1, Math.max(0, Math.floor((clientX - bounds.left) * width / bounds.width))),
    y: Math.min(height - 1, Math.max(0, Math.floor((clientY - bounds.top) * height / bounds.height))),
  };
}

export function selectionFromDrag382(start: SelectionPoint382, end: SelectionPoint382, width: number, height: number, shape: SelectionShape382): ImageSelection382 {
  sourceDimensions(width, height);
  pointInSource(start, width, height);
  pointInSource(end, width, height);
  const selection = {
    x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x) + 1, height: Math.abs(end.y - start.y) + 1, shape,
  };
  validateSelection(selection, width, height);
  return selection;
}

export function moveSelection382(selection: ImageSelection382, deltaX: number, deltaY: number, width: number, height: number): ImageSelection382 {
  sourceDimensions(width, height);
  validateSelection(selection, width, height);
  if (!Number.isSafeInteger(deltaX) || !Number.isSafeInteger(deltaY)) throw new ImageVisualError("INVALID_INPUT", "Keyboard movement requires whole pixels");
  return {
    ...selection,
    x: Math.max(0, Math.min(width - selection.width, selection.x + deltaX)),
    y: Math.max(0, Math.min(height - selection.height, selection.y + deltaY)),
  };
}

function ellipseCoverage382(x: number, y: number, width: number, height: number): number {
  let inside = 0;
  // Deterministic 4x4 supersampling: antialiased alpha at the exact pixel boundary.
  for (let sy = 0; sy < 4; sy += 1) {
    for (let sx = 0; sx < 4; sx += 1) {
      const dx = (x + (sx + 0.5) / 4 - width / 2) / (width / 2);
      const dy = (y + (sy + 0.5) / 4 - height / 2) / (height / 2);
      if (dx * dx + dy * dy <= 1) inside += 1;
    }
  }
  return inside / 16;
}

/** Pure selection over the current native transform pipeline, with no original-byte mutation. */
export function selectImagePixels382(source: PixelFrame, selection: ImageSelection382, mode: SelectionMode382 = "crop", signal?: AbortSignal): PixelFrame {
  abortIfNeeded(signal);
  sourceDimensions(source.width, source.height);
  if (!(source.data instanceof Uint8ClampedArray) || source.data.length !== source.width * source.height * 4) {
    throw new ImageVisualError("INVALID_INPUT", "RGBA source buffer dimensions disagree");
  }
  validateSelection(selection, source.width, source.height);
  if (mode !== "crop" && mode !== "mask") throw new ImageVisualError("INVALID_INPUT", "Selection output must be crop or mask");
  const transform = defaultImageTransformState(source.width, source.height);
  const rect = mode === "crop"
    ? { x: selection.x, y: selection.y, width: selection.width, height: selection.height }
    : transform.crop;
  // Reuses the validated crop and RGBA pipeline. Do not fork the image transform engine.
  const result = applyImageTransformPixels(source, { ...transform, crop: rect });
  for (let y = 0; y < result.height; y += 1) {
    if ((y & 255) === 0) abortIfNeeded(signal);
    for (let x = 0; x < result.width; x += 1) {
      const sourceX = x + (mode === "crop" ? selection.x : 0);
      const sourceY = y + (mode === "crop" ? selection.y : 0);
      const localX = sourceX - selection.x;
      const localY = sourceY - selection.y;
      const within = localX >= 0 && localY >= 0 && localX < selection.width && localY < selection.height;
      const coverage = !within ? 0 : (selection.shape === "ellipse"
        ? ellipseCoverage382(localX, localY, selection.width, selection.height) : 1) *
        (selection.coverage?.[localY * selection.width + localX] ?? 255) / 255;
      const offset = (y * result.width + x) * 4 + 3;
      result.data[offset] = Math.round((result.data[offset] ?? 0) * coverage);
    }
  }
  abortIfNeeded(signal);
  return { width: result.width, height: result.height, data: result.data };
}

export async function renderImageSelectionLocal382(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void) {
  if (typeof input !== "object" || input === null) throw new ImageVisualError("INVALID_INPUT", "Selection input is required");
  const record = input as Record<string, unknown>;
  const file = assertFile(record.file);
  // Inspect the encoded dimensions before allocating a decoded bitmap.
  const header = await readHeader(file, signal);
  sourceDimensions(header.width, header.height);
  const source = await readImageTransformSource(file.blob, signal, progress);
  const selection = record.selection as ImageSelection382;
  const mode = record.mode as SelectionMode382;
  progress?.({ phase: "transform", label: "Applying alpha-preserving image selection" });
  const pixels = selectImagePixels382(source, selection, mode, signal);
  const blob = await outputBlob(pixelFrameToCanvas(pixels), "image/png", undefined, pixels.width, pixels.height, signal, progress);
  return {
    blob, filename: `${normalizeName(file.name)}-${mode === "crop" ? "selezione" : "maschera"}.png`,
    outputMime: "image/png" as const, inputMime: header.mime, width: pixels.width, height: pixels.height,
    selection, selectionMode: mode, alphaPolicy: "preserved" as const,
    sourceWidth: source.width, sourceHeight: source.height,
  };
}
