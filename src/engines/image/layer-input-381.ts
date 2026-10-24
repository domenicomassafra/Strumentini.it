import { inspectImageHeader } from "./format";
import { IMAGE_LAYER_381_LIMITS } from "./layer-compositor-381";
import { IMAGE_VISUAL_LIMITS, ImageVisualError, abortIfNeeded } from "./visual";

/** Read only headers before decoding any layer; refuse an aggregate that would exceed the RGBA budget. */
export async function preflightLayerImages381(files: readonly Blob[], signal?: AbortSignal) {
  abortIfNeeded(signal);
  if (files.length < 1 || files.length > IMAGE_LAYER_381_LIMITS.maxLayers) {
    throw new ImageVisualError("INVALID_INPUT", "Select between 1 and 16 layers");
  }
  let totalPixels = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  for (const [index, file] of files.entries()) {
    abortIfNeeded(signal);
    if (!(file instanceof Blob) || file.size < 1 || file.size > IMAGE_VISUAL_LIMITS.maxFileBytes) {
      throw new ImageVisualError("FILE_TOO_LARGE", "Layer file has invalid or excessive bytes");
    }
    const header = inspectImageHeader(new Uint8Array(await file.slice(0, 2 * 1024 * 1024).arrayBuffer()));
    const { width, height } = header;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 1 || height < 1
      || width > IMAGE_LAYER_381_LIMITS.maxDimension || height > IMAGE_LAYER_381_LIMITS.maxDimension) {
      throw new ImageVisualError("PIXEL_LIMIT", "Layer dimensions exceed compositor limits");
    }
    const pixels = width * height;
    totalPixels += pixels;
    if (totalPixels > IMAGE_LAYER_381_LIMITS.maxInputPixels) {
      throw new ImageVisualError("PIXEL_LIMIT", "Aggregate layer pixels exceed compositor budget");
    }
    if (index === 0) {
      canvasWidth = width;
      canvasHeight = height;
      if (pixels > IMAGE_LAYER_381_LIMITS.maxOutputPixels) {
        throw new ImageVisualError("PIXEL_LIMIT", "Canvas exceeds compositor output budget");
      }
    }
  }
  abortIfNeeded(signal);
  return { width: canvasWidth, height: canvasHeight, totalPixels };
}
