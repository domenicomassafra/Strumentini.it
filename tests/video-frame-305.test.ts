import { describe, expect, it } from "vitest";
import { validateFrameRequest305 } from "../src/engines/video/frame-extract-305";

describe("#305 — local decoded-frame preflight", () => {
  it("accepts bounded timestamps within real known duration and dimensions", () => {
    for (const second of [0, 0.001, 0.3, 0.999]) {
      expect(() => validateFrameRequest305(second, 1, 640, 480)).not.toThrow();
    }
  });
  it("rejects out-of-range source time without clamping or pretending frame exactness", () => {
    for (const second of [-1, 1, 100, NaN, Infinity]) {
      expect(() => validateFrameRequest305(second, 1, 64, 48)).toThrow(/VIDEO_FRAME_RANGE/);
    }
    for (const length of [0, -1, NaN, Infinity, 3600.001]) {
      expect(() => validateFrameRequest305(0, length, 64, 48)).toThrow(/VIDEO_FRAME_RANGE/);
    }
  });
  it("enforces pixel and dimension caps before canvas allocation", () => {
    for (const [width, height] of [[0, 1], [2, 0], [8193, 12], [4000, 4000], [Infinity, 100], [40.5, 3], [1, NaN]]) {
      expect(() => validateFrameRequest305(0, 1, width!, height!)).toThrow(/VIDEO_FRAME_PIXEL_LIMIT/);
    }
  });
});
