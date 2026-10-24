import { inspectImageHeader } from "./format";
import { outputBlob } from "./operations";
import { computeResizePlan, preflightAllocation } from "./policy";
import { resizeWithPica271 } from "./resize-pica-271";
import {
  adjustSrgbPixels383, inspectEditorSource383, MAX_EDITOR_PIXELS_383,
  type ColorAdjustments383, type EditorColorPolicy383,
} from "./color-adjustment-383";

export interface ImageEditorInput383 {
  readonly file: Blob;
  readonly width: number;
  readonly height: number;
  readonly fit: "contain" | "cover";
  readonly adjustments: ColorAdjustments383;
}

export interface ImageEditorOutput383 {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly color: EditorColorPolicy383;
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

/**
 * Standalone operation until the #140 editor provides the canvas/layer UI.
 * Unknown profiles refuse before browser decode; output is a new PNG only.
 */
export async function adjustImageFile383(input: ImageEditorInput383, signal?: AbortSignal): Promise<ImageEditorOutput383> {
  abortIfNeeded(signal);
  if (!input || !(input.file instanceof Blob) || !input.adjustments || typeof document === "undefined" ||
      typeof createImageBitmap !== "function") {
    throw new Error("INVALID_INPUT: A local image and browser Canvas are required");
  }
  const color = await inspectEditorSource383(input.file, signal);
  abortIfNeeded(signal);
  const header = inspectImageHeader(new Uint8Array(await input.file.slice(0, 2 * 1024 * 1024).arrayBuffer()));
  if (header.width * header.height > MAX_EDITOR_PIXELS_383) {
    throw new Error("MEMORY_LIMIT: Source exceeds the bounded color editor budget");
  }
  preflightAllocation(input.file.size, header.width, header.height, 1, 1);
  const initial = computeResizePlan(header.width, header.height, input.width, input.height, input.fit);
  preflightAllocation(input.file.size, header.width, header.height, initial.outputWidth, initial.outputHeight);
  if (initial.outputWidth * initial.outputHeight > MAX_EDITOR_PIXELS_383) {
    throw new Error("MEMORY_LIMIT: Output exceeds the bounded color editor budget");
  }
  abortIfNeeded(signal);

  const bitmap = await createImageBitmap(input.file, { imageOrientation: "none", colorSpaceConversion: "default" });
  let canvas: HTMLCanvasElement | undefined;
  try {
    abortIfNeeded(signal);
    if (bitmap.width !== header.width || bitmap.height !== header.height) {
      throw new Error("UNVERIFIED_COLOR_PROFILE: Browser dimensions disagree with the verified source");
    }
    const plan = computeResizePlan(bitmap.width, bitmap.height, input.width, input.height, input.fit);
    const allocation = preflightAllocation(input.file.size, bitmap.width, bitmap.height, plan.outputWidth, plan.outputHeight);
    if (plan.outputWidth * plan.outputHeight > MAX_EDITOR_PIXELS_383) {
      throw new Error("MEMORY_LIMIT: Output exceeds the bounded color editor budget");
    }
    canvas = document.createElement("canvas");
    canvas.width = plan.outputWidth;
    canvas.height = plan.outputHeight;
    const context = canvas.getContext("2d", { colorSpace: "srgb", willReadFrequently: true });
    if (!context || context.getContextAttributes?.().colorSpace !== "srgb") {
      throw new Error("UNVERIFIED_COLOR_PROFILE: Browser cannot confirm an sRGB canvas");
    }
    const resampling = await resizeWithPica271(bitmap, plan, canvas, allocation.estimatedDecodedBytes, signal);
    if (resampling.engine === "canvas") {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, plan.sourceX, plan.sourceY, plan.sourceWidth, plan.sourceHeight,
        0, 0, plan.outputWidth, plan.outputHeight);
    }
    abortIfNeeded(signal);
    const frame = context.getImageData(0, 0, plan.outputWidth, plan.outputHeight, { colorSpace: "srgb" });
    if (frame.colorSpace !== "srgb") {
      throw new Error("UNVERIFIED_COLOR_PROFILE: Browser returned unverified pixel color space");
    }
    const adjusted = adjustSrgbPixels383(frame, input.adjustments, signal);
    const dest = context.createImageData(plan.outputWidth, plan.outputHeight, { colorSpace: "srgb" });
    if (dest.colorSpace !== "srgb") {
      throw new Error("UNVERIFIED_COLOR_PROFILE: Browser cannot encode adjusted pixels as sRGB");
    }
    dest.data.set(adjusted.data);
    context.putImageData(dest, 0, 0);
    abortIfNeeded(signal);
    const blob = await outputBlob(canvas, "image/png", undefined, plan.outputWidth, plan.outputHeight, signal);
    return { blob, width: plan.outputWidth, height: plan.outputHeight, color };
  } finally {
    bitmap.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
