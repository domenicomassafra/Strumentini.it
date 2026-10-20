import { describe, expect, it } from "vitest";
// Oracle from already-installed sharp 0.35.5 / libvips (Apache-2.0); upstream tag commit 51a990faa26ade5586a4934ac9673c98d8893326.
import sharp from "sharp";
import { composeImageLayers381 } from "../src/engines/image/layer-compositor-381";

function solid(r: number, g: number, b: number, a = 255) {
  return { width: 1, height: 1, data: new Uint8ClampedArray([r, g, b, a]) };
}

function rgba(data: Uint8ClampedArray): number[] {
  return Array.from(data);
}

const red = solid(255, 0, 0);
const blue = solid(0, 0, 255);

describe("STR-381 local image layer compositor", () => {
  it("changes the pixels when order, per-layer opacity, and visibility change", () => {
    const rear = { frame: red, x: 0, y: 0, opacity: 1, visible: true };
    const front = { frame: blue, x: 0, y: 0, opacity: 0.5, visible: true };
    expect(rgba(composeImageLayers381(1, 1, [rear, front]).data)).toEqual([128, 0, 128, 255]);
    expect(rgba(composeImageLayers381(1, 1, [front, rear]).data)).toEqual([255, 0, 0, 255]);
    expect(rgba(composeImageLayers381(1, 1, [rear, { ...front, visible: false }]).data)).toEqual([255, 0, 0, 255]);
    expect(rgba(composeImageLayers381(1, 1, [rear, { ...front, opacity: 0 }]).data)).toEqual([255, 0, 0, 255]);
    expect(rgba(red.data)).toEqual([255, 0, 0, 255]);
  });

  it("composes straight-alpha correctly without dark fringe and clips translated layers", () => {
    const halfRed = solid(255, 0, 0, 128);
    const result = composeImageLayers381(2, 1, [
      { frame: halfRed, x: 1, y: 0, opacity: 0.5, visible: true },
      { frame: blue, x: 2, y: 0, opacity: 1, visible: true },
    ]);
    expect(rgba(result.data)).toEqual([0, 0, 0, 0, 255, 0, 0, 64]);
  });

  it("agrees with independent sharp/libvips source-over pixels for overlapping alpha PNG inputs", async () => {
    const backing = { width: 2, height: 1, data: new Uint8ClampedArray([15, 45, 75, 255, 255, 0, 0, 255]) };
    const overlay = { width: 2, height: 1, data: new Uint8ClampedArray([0, 255, 0, 128, 0, 0, 255, 192]) };
    const ours = composeImageLayers381(2, 1, [
      { frame: backing, x: 0, y: 0, opacity: 1, visible: true },
      { frame: overlay, x: 0, y: 0, opacity: 1, visible: true },
    ]);
    const raw = { width: 2, height: 1, channels: 4 as const };
    const oracle = await sharp(Buffer.from(backing.data), { raw })
      .composite([{ input: await sharp(Buffer.from(overlay.data), { raw }).png().toBuffer(), left: 0, top: 0 }])
      .raw().toBuffer({ resolveWithObject: true });
    expect(oracle.info.width).toBe(2);
    expect(oracle.info.height).toBe(1);
    const actual = rgba(ours.data);
    const independent = Array.from(oracle.data);
    expect(actual).toHaveLength(independent.length);
    for (let index = 0; index < actual.length; index++) {
      expect(Math.abs(actual[index]! - independent[index]!)).toBeLessThanOrEqual(1);
    }
  });

  it("rejects oversized, malformed, or cancelled jobs before any output allocation", () => {
    const layer = { frame: red, x: 0, y: 0, opacity: 1, visible: true };
    expect(() => composeImageLayers381(4096, 4096, [layer])).toThrow(/PIXEL_LIMIT/u);
    expect(() => composeImageLayers381(1, 1, [{ ...layer, opacity: Number.NaN }])).toThrow(/INVALID_INPUT/u);
    expect(() => composeImageLayers381(1, 1, [{ ...layer, frame: { ...red, data: new Uint8ClampedArray(3) } }])).toThrow(/INVALID_INPUT/u);
    expect(() => composeImageLayers381(1, 1, [{ ...layer, x: Number.POSITIVE_INFINITY }])).toThrow(/INVALID_INPUT/u);
    expect(() => composeImageLayers381(1, 1, Array.from({ length: 17 }, () => layer))).toThrow(/INVALID_INPUT/u);
    const cancelled = new AbortController();
    cancelled.abort();
    expect(() => composeImageLayers381(1, 1, [layer], cancelled.signal)).toThrow(/Operation cancelled/u);
  });
});
