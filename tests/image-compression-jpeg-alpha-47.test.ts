import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { compressImageLocal } from "../src/engines/image/visual-tools";

afterEach(() => vi.unstubAllGlobals());

async function fixture(alpha: boolean) {
  const rgba = Buffer.alloc(8 * 6 * 4);
  for (let i = 0; i < 8 * 6; i++) {
    rgba[4 * i] = 45;
    rgba[4 * i + 1] = 145;
    rgba[4 * i + 2] = 205;
    rgba[4 * i + 3] = alpha && i % 3 === 0 ? 87 : 255;
  }
  const png = await sharp(rgba, { raw: { width: 8, height: 6, channels: 4 } }).png().toBuffer();
  const jpeg = await sharp(rgba, { raw: { width: 8, height: 6, channels: 4 } }).flatten({ background: "white" }).jpeg().toBuffer();
  return { png, jpeg, rgba };
}

/** Native PNG/JPEG bytes and dimensions; stub only browser DOM rendering. */
function mockCanvas(rgba: Buffer, jpeg: Buffer) {
  const bitmap = { width: 8, height: 6, close: vi.fn() };
  const context = {
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(rgba) }),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  };
  let decoded = 0;
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ++decoded === 1 ? bitmap : { width: 8, height: 6, close: vi.fn() }));
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => context,
      toBlob: (callback: (value: Blob) => void) => callback(new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" })),
    }),
  });
  return bitmap;
}

describe("#81 JPEG compression alpha gate", () => {
  it.each([
    ["normal", undefined],
    ["target", 10],
  ])("refuses unannounced flattening of PNG with alpha in %s mode", async (_label, targetKiB) => {
    const { png, jpeg, rgba } = await fixture(true);
    const bitmap = mockCanvas(rgba, jpeg);
    const file = new File([new Uint8Array(png)], "transparent.png", { type: "image/png" });
    await expect(compressImageLocal({ file, mime: "image/jpeg", quality: 0.7, ...(targetKiB ? { targetKiB } : {}) }))
      .rejects.toThrow(/JPEG_ALPHA_BACKGROUND_REQUIRED/u);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("allows an opaque PNG and produces an independently readable JPEG", async () => {
    const { png, jpeg, rgba } = await fixture(false);
    const bitmap = mockCanvas(rgba, jpeg);
    const file = new File([new Uint8Array(png)], "opaque.png", { type: "image/png" });
    const result = await compressImageLocal({ file, mime: "image/jpeg", quality: 0.7 });
    expect(result.outputMime).toBe("image/jpeg");
    expect(result.width).toBe(8);
    expect(result.height).toBe(6);
    expect((await sharp(Buffer.from(await result.blob.arrayBuffer())).metadata()).format).toBe("jpeg");
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
