import { describe, expect, it } from "vitest";
import {
  normalizePerspectiveCorners,
  perspectiveTransformPixels,
  planSlices,
  suggestScreenshotOverlapFromFrames,
} from "../src/engines/image/advanced-workspace";
import type { PixelFrame } from "../src/engines/image/transform-workspace";

function frame(width: number, height: number, rows: readonly number[][]): PixelFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = rows[y]?.[x] ?? 0;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("advanced image workspace pure geometry", () => {
  it("plans exact deterministic horizontal and vertical slices including remainders", () => {
    expect(planSlices(10, 4, 3, "horizontal")).toEqual([
      { index: 1, width: 4, height: 4, x: 0, y: 0 },
      { index: 2, width: 3, height: 4, x: 4, y: 0 },
      { index: 3, width: 3, height: 4, x: 7, y: 0 },
    ]);
    expect(planSlices(5, 7, 3, "vertical")).toEqual([
      { index: 1, width: 5, height: 3, x: 0, y: 0 },
      { index: 2, width: 5, height: 2, x: 0, y: 3 },
      { index: 3, width: 5, height: 2, x: 0, y: 5 },
    ]);
  });

  it("suggests the known screenshot overlap with high confidence", () => {
    const first = frame(2, 4, [[10, 20], [30, 40], [50, 60], [70, 80]]);
    const second = frame(2, 4, [[50, 60], [70, 80], [90, 100], [110, 120]]);
    const suggestion = suggestScreenshotOverlapFromFrames(first, second, "vertical");
    expect(suggestion.suggestedOverlap).toBe(2);
    expect(suggestion.confidence).toBe(1);
    expect(suggestion.ambiguous).toBe(false);
    expect(suggestion.confidenceMargin).toBeGreaterThan(0.02);
  });

  it("marks repeated-pattern overlap as ambiguous instead of silently choosing content to discard", () => {
    const repeated = frame(2, 5, Array.from({ length: 5 }, () => [80, 80]));
    const suggestion = suggestScreenshotOverlapFromFrames(repeated, repeated, "vertical");
    expect(suggestion.confidence).toBe(1);
    expect(suggestion.secondBestConfidence).toBe(1);
    expect(suggestion.confidenceMargin).toBe(0);
    expect(suggestion.ambiguous).toBe(true);
  });

  it("validates four in-bounds convex corners and rejects out-of-bounds/self-crossing/degenerate geometry", () => {
    const valid = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 3, y: 0 },
      bottomRight: { x: 3, y: 2 },
      bottomLeft: { x: 0, y: 2 },
    };
    expect(normalizePerspectiveCorners(valid, 4, 3)).toEqual(valid);
    expect(() => normalizePerspectiveCorners({ ...valid, topLeft: { x: -1, y: 0 } }, 4, 3)).toThrow(/inside/u);
    expect(() => normalizePerspectiveCorners({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 3, y: 2 },
      bottomRight: { x: 3, y: 0 },
      bottomLeft: { x: 0, y: 2 },
    }, 4, 3)).toThrow(/self-crossing|concave|degenerate/u);
    expect(() => normalizePerspectiveCorners({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 2, y: 0 },
      bottomLeft: { x: 3, y: 0 },
    }, 4, 3)).toThrow(/self-crossing|concave|degenerate/u);
  });

  it("identity four-corner perspective produces exact deterministic source pixels and explicit boundary", () => {
    const source = frame(3, 2, [[10, 20, 30], [40, 50, 60]]);
    const corners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 2, y: 0 },
      bottomRight: { x: 2, y: 1 },
      bottomLeft: { x: 0, y: 1 },
    };
    const first = perspectiveTransformPixels(source, corners);
    const second = perspectiveTransformPixels(source, corners);
    expect(first.width).toBe(3);
    expect(first.height).toBe(2);
    expect(Array.from(first.data)).toEqual(Array.from(source.data));
    expect(Array.from(second.data)).toEqual(Array.from(first.data));
    expect(first.boundary).toEqual({ polygon: [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft], sourceWidth: 3, sourceHeight: 2 });
    expect(first.sampling).toBe("inverse-homography-bilinear-rgba");
  });
});
