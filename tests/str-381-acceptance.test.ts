import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { composeImageLayers381 } from "../src/engines/image/layer-compositor-381";

const frame = (rgba: number[]) => ({ width: 1, height: 1, data: new Uint8ClampedArray(rgba) });
const back = frame([255, 0, 0, 255]);
const front = frame([0, 0, 255, 255]);
const layer = (source: typeof back, opacity = 1, visible = true) => ({ frame: source, x: 0, y: 0, opacity, visible });

describe("STR-381 layers contract", () => {
  it("reorders, hides and blends independently; never mutates source buffers", () => {
    const backBefore = [...back.data];
    const frontBefore = [...front.data];
    expect([...composeImageLayers381(1, 1, [layer(back), layer(front, 0.5)]).data]).toEqual([128, 0, 128, 255]);
    expect([...composeImageLayers381(1, 1, [layer(front, 0.5), layer(back)]).data]).toEqual(backBefore);
    expect([...composeImageLayers381(1, 1, [layer(back), layer(front, 0.5, false)]).data]).toEqual(backBefore);
    expect([...composeImageLayers381(1, 1, [layer(back), layer(front, 0)]).data]).toEqual(backBefore);
    expect([...back.data]).toEqual(backBefore);
    expect([...front.data]).toEqual(frontBefore);
  });

  it("matches an independent libvips pixel oracle at overlapping alpha", async () => {
    const rear = frame([15, 45, 75, 255]);
    const top = frame([0, 255, 0, 128]);
    const actual = composeImageLayers381(1, 1, [layer(rear), layer(top)]);
    const raw = { width: 1, height: 1, channels: 4 as const };
    const oracle = await sharp(Buffer.from(rear.data), { raw })
      .composite([{ input: await sharp(Buffer.from(top.data), { raw }).png().toBuffer(), left: 0, top: 0 }])
      .raw().toBuffer();
    for (let i = 0; i < actual.data.length; i++) {
      expect(Math.abs(actual.data[i]! - oracle[i]!)).toBeLessThanOrEqual(1);
    }
  });
});
