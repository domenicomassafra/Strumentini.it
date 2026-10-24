import { describe, expect, it } from "vitest";
import { selectImagePixels382, type ImageSelection382 } from "../src/engines/image/selection-mask-382";

const source = {
  width: 3,
  height: 2,
  data: new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 80,
    255, 255, 0, 255, 20, 40, 60, 200, 150, 100, 50, 255,
  ]),
};

describe("STR-382 RGBA selection, mask, crop", () => {
  it("crops a half-open rectangle, preserving source alpha and the original bytes", () => {
    const before = [...source.data];
    const selection: ImageSelection382 = { x: 1, y: 0, width: 2, height: 2, shape: "rectangle" };
    const pixels = selectImagePixels382(source, selection, "crop");
    expect([pixels.width, pixels.height]).toEqual([2, 2]);
    expect([...pixels.data]).toEqual([
      0, 255, 0, 128, 0, 0, 255, 80,
      20, 40, 60, 200, 150, 100, 50, 255,
    ]);
    expect([...source.data]).toEqual(before);
    pixels.data[3] = 0;
    expect(source.data[7]).toBe(128);
  });

  it("masks outside a selection without changing dimensions or source pixels", () => {
    const result = selectImagePixels382(source, { x: 1, y: 0, width: 1, height: 2, shape: "rectangle" }, "mask");
    expect([result.width, result.height]).toEqual([3, 2]);
    expect([result.data[3], result.data[7], result.data[11], result.data[15], result.data[19], result.data[23]]).toEqual([0, 128, 0, 0, 200, 0]);
    expect(result.data.slice(4, 8)).toEqual(source.data.slice(4, 8));
  });

  it("multiplies partial mask coverage with existing alpha rather than replacing it", () => {
    const selection: ImageSelection382 = { x: 1, y: 0, width: 1, height: 2, shape: "rectangle", coverage: new Uint8ClampedArray([128, 0]) };
    const result = selectImagePixels382(source, selection, "crop");
    expect([result.data[3], result.data[7]]).toEqual([64, 0]);
    expect(source.data[7]).toBe(128);
    expect(selection.coverage![0]).toBe(128);
  });

  it("gives an ellipse fractional edge alpha while leaving the center unchanged", () => {
    const frame = { width: 5, height: 5, data: new Uint8ClampedArray(5 * 5 * 4) };
    for (let i = 0; i < 25; i += 1) frame.data[i * 4 + 3] = 200;
    const result = selectImagePixels382(frame, { x: 0, y: 0, width: 5, height: 5, shape: "ellipse" }, "mask");
    expect(result.data[(2 * 5 + 2) * 4 + 3]).toBe(200);
    expect(result.data[3]).toBeGreaterThan(0);
    expect(result.data[3]).toBeLessThan(200);
    const topEdge = result.data[(0 * 5 + 1) * 4 + 3]!;
    expect(topEdge).toBeGreaterThan(0);
    expect(topEdge).toBeLessThan(200);
  });
});
