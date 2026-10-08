import { PDF_THUMBNAIL_MAX_HEIGHT, PDF_THUMBNAIL_MAX_WIDTH } from "./thumbnails";

export interface PdfVisualPixelDiff {
  readonly status: "sample-match" | "different" | "partial";
  readonly changedPixels: number;
  readonly totalPixels: number;
  /** Red pixels indicate differences; grayscale pixels were unchanged. */
  readonly rgba: Uint8ClampedArray | null;
  readonly reason?: string;
}

/** Compare actual decoded PNG pixels, not extracted text or PDF byte containers. */
export function comparePdfThumbnailPixels(
  first: { width: number; height: number; rgba: Uint8ClampedArray },
  second: { width: number; height: number; rgba: Uint8ClampedArray },
): PdfVisualPixelDiff {
  const valid = (item: typeof first) =>
    Number.isInteger(item.width) && Number.isInteger(item.height)
    && item.width >= 1 && item.height >= 1
    && item.width <= PDF_THUMBNAIL_MAX_WIDTH && item.height <= PDF_THUMBNAIL_MAX_HEIGHT
    && item.rgba.length === item.width * item.height * 4;
  if (!valid(first) || !valid(second)) {
    return { status: "partial", changedPixels: 0, totalPixels: 0, rgba: null, reason: "Anteprima oltre i limiti o pixel non leggibili" };
  }
  if (first.width !== second.width || first.height !== second.height) {
    return {
      status: "partial", changedPixels: 0, totalPixels: 0, rgba: null,
      reason: "Geometria o dimensioni delle miniature diverse: il confronto pixel non è direttamente allineabile",
    };
  }
  const out = new Uint8ClampedArray(first.rgba.length);
  let changedPixels = 0;
  for (let pixel = 0; pixel < first.width * first.height; pixel++) {
    const offset = pixel * 4;
    const different = Array.from({ length: 4 }, (_, component) =>
      first.rgba[offset + component] !== second.rgba[offset + component]).some(Boolean);
    if (different) {
      changedPixels += 1;
      out.set([225, 35, 35, 255], offset);
    } else {
      const grey = Math.round(
        (first.rgba[offset]! + first.rgba[offset + 1]! + first.rgba[offset + 2]!) / 3 * 0.6 + 100,
      );
      out.set([grey, grey, grey, 255], offset);
    }
  }
  return {
    status: changedPixels === 0 ? "sample-match" : "different",
    changedPixels,
    totalPixels: first.width * first.height,
    rgba: out,
  };
}
