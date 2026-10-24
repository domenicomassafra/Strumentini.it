import { normalizeImageTransformState, type ImageTransformState, type PixelFrame } from "../../../engines/image/transform-workspace";

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function cropMoved(state: ImageTransformState, source: PixelFrame, deltaX: number, deltaY: number): ImageTransformState {
  return {
    ...state,
    crop: {
      ...state.crop,
      x: clamp(Math.round(state.crop.x + deltaX), 0, source.width - state.crop.width),
      y: clamp(Math.round(state.crop.y + deltaY), 0, source.height - state.crop.height),
    },
  };
}

export function transformedContentDimensions(state: ImageTransformState): { width: number; height: number } {
  return state.rotate === 90 || state.rotate === 270
    ? { width: state.crop.height, height: state.crop.width }
    : { width: state.crop.width, height: state.crop.height };
}

export function contentPoint(event: PointerEvent, canvas: HTMLCanvasElement, source: PixelFrame, state: ImageTransformState): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const normalized = normalizeImageTransformState(state, source.width, source.height);
  const dimensions = transformedContentDimensions(normalized);
  const canvasX = (event.clientX - rect.left) * canvas.width / rect.width;
  const canvasY = (event.clientY - rect.top) * canvas.height / rect.height;
  const x = Math.floor(canvasX - normalized.border);
  const y = Math.floor(canvasY - normalized.border);
  if (x < 0 || y < 0 || x >= dimensions.width || y >= dimensions.height) return null;
  return { x, y };
}
