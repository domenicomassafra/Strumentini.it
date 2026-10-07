import { describe, expect, it } from "vitest";
import {
  applyImageTransformPixels,
  commitImageTransform,
  createImageTransformHistory,
  defaultImageTransformState,
  resetImageTransform,
  undoImageTransform,
} from "../src/engines/image/transform-workspace";

const source = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    255, 0, 0, 255,   0, 255, 0, 128,
    0, 0, 255, 255,   255, 255, 255, 255,
  ]),
};

describe("direct image transform workspace", () => {
  it("uses one deterministic pixel pipeline for crop rotate flip and tonal controls", () => {
    const initial = defaultImageTransformState(2, 2);
    const result = applyImageTransformPixels(source, { ...initial, rotate: 90, flipHorizontal: true, brightness: 10 });
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.pipeline).toEqual(expect.arrayContaining(["rotate 90° clockwise", "flip horizontal=true vertical=false"]));
    expect(Array.from(result.data)).not.toEqual(Array.from(source.data));
  });

  it("makes round-crop alpha and explicit background flattening observable", () => {
    const initial = defaultImageTransformState(2, 2);
    const transparent = applyImageTransformPixels(source, { ...initial, roundCrop: true });
    expect(transparent.alphaPolicy).toBe("preserved");
    const flattened = applyImageTransformPixels(source, { ...initial, roundCrop: true, backgroundMode: "color", backgroundColor: "#ffffff" });
    expect(flattened.alphaPolicy).toBe("flattened-to-background");
    expect([...flattened.data].filter((_value, index) => index % 4 === 3).every((alpha) => alpha === 255)).toBe(true);
  });

  it("rewrites redacted pixels destructively and keeps multiple regions in history", () => {
    const initial = defaultImageTransformState(2, 2);
    const redacted = applyImageTransformPixels(source, {
      ...initial,
      redactions: [
        { x: 0, y: 0, width: 1, height: 1, mode: "solid", color: "#000000" },
        { x: 1, y: 1, width: 1, height: 1, mode: "pixelate", color: "#000000" },
      ],
    });
    expect(Array.from(redacted.data.slice(0, 4))).toEqual([0, 0, 0, 255]);
    expect(redacted.pipeline).toEqual(expect.arrayContaining(["apply 2 destructive pixel redaction region(s)"]));
    expect(Array.from(redacted.data.slice(0, 4))).not.toEqual(Array.from(source.data.slice(0, 4)));
  });

  it("undo and reset deterministically restore prior exact state", () => {
    const initial = defaultImageTransformState(2, 2);
    const first = commitImageTransform(createImageTransformHistory(initial), { ...initial, rotate: 90 });
    const second = commitImageTransform(first, { ...first.current, border: 3, backgroundMode: "color" });
    expect(undoImageTransform(second).current).toEqual(first.current);
    expect(resetImageTransform(second)).toEqual({ initial, current: initial, past: [] });
  });
});
