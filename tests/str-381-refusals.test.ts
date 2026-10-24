import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { composeImageLayers381, IMAGE_LAYER_381_LIMITS } from "../src/engines/image/layer-compositor-381";
import { preflightLayerImages381 } from "../src/engines/image/layer-input-381";

const one = { width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255]) };
const item = { frame: one, x: 0, y: 0, opacity: 1, visible: true };

describe("STR-381 resource and invalid-input refusals", () => {
  it("refuses giant canvases, aggregate pixels including hidden layers, malformed arrays and cancellation", () => {
    expect(() => composeImageLayers381(8192, 8192, [item])).toThrow(/PIXEL_LIMIT/u);
    const tooLarge = { width: 2000, height: 2000, data: new Uint8ClampedArray(16_000_000) };
    expect(() => composeImageLayers381(1, 1, [
      { ...item, frame: tooLarge, visible: false }, { ...item, frame: tooLarge, visible: false }, { ...item, frame: one },
    ])).toThrow(/PIXEL_LIMIT/u);
    expect(() => composeImageLayers381(1, 1, [{ ...item, frame: { ...one, data: new Uint8ClampedArray(3) } }])).toThrow(/INVALID_INPUT/u);
    expect(() => composeImageLayers381(1, 1, [{ ...item, opacity: Number.NaN }])).toThrow(/INVALID_INPUT/u);
    expect(() => composeImageLayers381(1, 1, Array.from({ length: IMAGE_LAYER_381_LIMITS.maxLayers + 1 }, () => item))).toThrow(/INVALID_INPUT/u);
    const controller = new AbortController();
    controller.abort();
    expect(() => composeImageLayers381(1, 1, [item], controller.signal)).toThrow(/Operation cancelled/u);
  });

  it("rejects header-only oversized inputs before pixel decoding or output allocations", async () => {
    const crc32 = (bytes: Uint8Array) => {
      let crc = 0xffffffff;
      for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      return (crc ^ 0xffffffff) >>> 0;
    };
    const png = async (width: number, height: number) => new Blob([await sharp({ create: {
      width: 1, height: 1, channels: 4, background: "red",
    } }).png().toBuffer().then((bytes) => {
      const cloned = Buffer.from(bytes);
      cloned.writeUInt32BE(width, 16);
      cloned.writeUInt32BE(height, 20);
      cloned.writeUInt32BE(crc32(cloned.subarray(12, 29)), 29);
      return cloned;
    })], { type: "image/png" });
    await expect(preflightLayerImages381([await png(8192, 8192)])).rejects.toThrow(/PIXEL_LIMIT/u);
    await expect(preflightLayerImages381([await png(1000, 1000), await png(2000, 2000), await png(2000, 2000)])).rejects.toThrow(/PIXEL_LIMIT/u);
    await expect(preflightLayerImages381([new Blob(["not an image"])])).rejects.toThrow();
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(preflightLayerImages381([await png(1, 1)], cancelled.signal)).rejects.toThrow(/Operation cancelled/u);
  });
});
