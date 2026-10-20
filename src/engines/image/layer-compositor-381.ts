import { abortIfNeeded, ImageVisualError } from "./visual";
import type { PixelFrame } from "./transform-workspace";

/** Data order is bottom-to-top. The caller owns reorder, visibility and per-layer opacity state. */
export interface ImageLayer381 {
  readonly frame: PixelFrame;
  readonly x: number;
  readonly y: number;
  readonly opacity: number;
  readonly visible: boolean;
}

// Conservative engine-only bounds; mobile acceptance must measure and revise them.
export const IMAGE_LAYER_381_LIMITS = {
  maxOutputPixels: 2_000_000,
  maxInputPixels: 8_000_000,
  maxLayers: 16,
  maxDimension: 8192,
} as const;

function validSize(width: number, height: number, label: string): number {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 1 || height < 1
    || width > IMAGE_LAYER_381_LIMITS.maxDimension || height > IMAGE_LAYER_381_LIMITS.maxDimension) {
    throw new ImageVisualError("INVALID_INPUT", `${label} dimensions must be positive, bounded integers`);
  }
  return width * height;
}

function preflight(width: number, height: number, layers: readonly ImageLayer381[], signal?: AbortSignal): void {
  abortIfNeeded(signal);
  if (validSize(width, height, "Canvas") > IMAGE_LAYER_381_LIMITS.maxOutputPixels) {
    throw new ImageVisualError("PIXEL_LIMIT", "Canvas exceeds bounded RGBA output budget");
  }
  if (!Array.isArray(layers) || layers.length < 1 || layers.length > IMAGE_LAYER_381_LIMITS.maxLayers) {
    throw new ImageVisualError("INVALID_INPUT", "Layer count exceeds bounded budget");
  }
  let inputPixels = 0;
  for (const layer of layers) {
    if (!layer || !layer.frame) throw new ImageVisualError("INVALID_INPUT", "Layer frame is required");
    const pixels = validSize(layer.frame.width, layer.frame.height, "Layer");
    inputPixels += pixels;
    if (inputPixels > IMAGE_LAYER_381_LIMITS.maxInputPixels) {
      throw new ImageVisualError("PIXEL_LIMIT", "Layer RGBA input budget exceeded");
    }
    if (!(layer.frame.data instanceof Uint8ClampedArray) || layer.frame.data.length !== pixels * 4) {
      throw new ImageVisualError("INVALID_INPUT", "Layer RGBA bytes do not match declared dimensions");
    }
    if (!Number.isSafeInteger(layer.x) || !Number.isSafeInteger(layer.y)
      || Math.abs(layer.x) > IMAGE_LAYER_381_LIMITS.maxDimension
      || Math.abs(layer.y) > IMAGE_LAYER_381_LIMITS.maxDimension
      || typeof layer.opacity !== "number" || !Number.isFinite(layer.opacity)
      || layer.opacity < 0 || layer.opacity > 1 || typeof layer.visible !== "boolean") {
      throw new ImageVisualError("INVALID_INPUT", "Layer position, opacity or visibility is invalid");
    }
  }
  abortIfNeeded(signal);
}

/** Deterministic straight-alpha source-over in RGBA/sRGB channel values. No input frame is mutated. */
export function composeImageLayers381(
  width: number, height: number, layers: readonly ImageLayer381[], signal?: AbortSignal,
): PixelFrame {
  preflight(width, height, layers, signal);
  const output = new Uint8ClampedArray(width * height * 4);
  for (const layer of layers) {
    if (!layer.visible || layer.opacity === 0) continue;
    const { frame, x, y, opacity } = layer;
    const left = Math.max(0, x);
    const right = Math.min(width, x + frame.width);
    const top = Math.max(0, y);
    const bottom = Math.min(height, y + frame.height);
    for (let row = top; row < bottom; row++) {
      abortIfNeeded(signal);
      for (let column = left; column < right; column++) {
        const sourceIndex = ((row - y) * frame.width + (column - x)) * 4;
        const targetIndex = (row * width + column) * 4;
        const frontAlpha = frame.data[sourceIndex + 3]! / 255 * opacity;
        if (frontAlpha === 0) continue;
        const backAlpha = output[targetIndex + 3]! / 255;
        const resultAlpha = frontAlpha + backAlpha * (1 - frontAlpha);
        for (let channel = 0; channel < 3; channel++) {
          output[targetIndex + channel] = Math.round((
            frame.data[sourceIndex + channel]! * frontAlpha
            + output[targetIndex + channel]! * backAlpha * (1 - frontAlpha)
          ) / resultAlpha);
        }
        output[targetIndex + 3] = Math.round(resultAlpha * 255);
      }
    }
  }
  abortIfNeeded(signal);
  return { width, height, data: output };
}
