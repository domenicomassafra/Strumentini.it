import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { compressImageLocal } from "../src/engines/image/visual-tools";
import { prepareImageResult } from "../src/components/tools/image-visual/ImageResultV2";

const fixture = async (): Promise<Buffer> => {
  const width = 64;
  const height = 48;
  const raw = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    raw[i * 4] = (i * 31) & 255;
    raw[i * 4 + 1] = (i * 7) & 255;
    raw[i * 4 + 2] = (i * 13) & 255;
    raw[i * 4 + 3] = i % 5 === 0 ? 0 : 255;
  }
  return sharp(raw, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 0 }).toBuffer();
};

describe("#047 public compression engine opt-in PNG lossless", () => {
  it("passes through the actual public tool engine and independently verifies downloaded output", async () => {
    const source = await fixture();
    const progress: string[] = [];
    const output = await compressImageLocal({
      file: new File([Uint8Array.from(source)], "alpha.png", { type: "image/png" }),
      mime: "image/png", pngLossless: true,
    }, undefined, (event) => progress.push(event.phase));
    expect(progress).toContain("encode");
    expect(output).toMatchObject({
      filename: "alpha-idat-lossless.png", inputMime: "image/png", outputMime: "image/png",
      width: 64, height: 48, compressionMode: "png-idat-lossless",
      pixelVerification: "exact-filtered-scanlines", keptOriginal: false,
    });
    expect(output.estimatedBytesSaved).toBe(source.byteLength - output.blob.size);
    expect(output.blob.size).toBeLessThan(source.byteLength);
    const bytes = Buffer.from(await output.blob.arrayBuffer());
    expect(await sharp(bytes).ensureAlpha().raw().toBuffer()).toEqual(
      await sharp(source).ensureAlpha().raw().toBuffer(),
    );
    const prepared = await prepareImageResult(output);
    expect(prepared.artifacts[0]?.artifact).toMatchObject({
      name: "alpha-idat-lossless.png", download: { ready: true },
      verification: { state: "verified", verifiedMime: "image/png" },
    });
  });

  it("refuses mismatched mode parameters and corrupt files, instead of silently using Canvas", async () => {
    const source = await fixture();
    const file = new File([Uint8Array.from(source)], "alpha.png", { type: "image/png" });
    for (const fields of [
      { mime: "image/jpeg" }, { mime: "image/png", targetKiB: 4 },
      { mime: "image/png", allowResize: true },
    ]) {
      await expect(compressImageLocal({ file, pngLossless: true, ...fields }))
        .rejects.toThrow(/INVALID_INPUT/u);
    }
    await expect(compressImageLocal({
      file: new File([new Uint8Array([1, 2, 3])], "bad.png", { type: "image/png" }),
      pngLossless: true, mime: "image/png",
    })).rejects.toThrow(/PNG_47_INPUT_LIMIT/u);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(compressImageLocal({ file, pngLossless: true, mime: "image/png" }, cancelled.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });
});
