import { describe, expect, it } from "vitest";
import { compressImageWithDonor47, DONOR_47_CAPABILITIES } from "../src/engines/image/compression-donor-047";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const transparent = resolve(root, "quality/fixtures/image-metadata/transparent-2x2-rgba.png");

describe("#047 installed donor adapter, no falsely advertised wasm/expert controls", () => {
  it("describes actual source-bound capabilities and explicit refused modes", () => {
    expect(DONOR_47_CAPABILITIES).toMatchObject({
      pngLossless: { supported: true, codec: "fflate", alpha: "byte-exact" },
      jpegLossy: { supported: true, codec: "browser-canvas", alpha: "refuse-transparent" },
      webpLossy: { supported: true, codec: "browser-canvas", alpha: "verify-decoded-exact" },
      pngPaletteExact: { supported: true, codec: "fflate" },
      pngPaletteLossy: { supported: true, codec: "fflate" },
      webpLossless: { supported: false },
      jpegNativeExpert: { supported: false },
    });
  });

  it("lazy-routes real lossless PNG transparencies through verified fflate IDAT and independently reopens pixels", async () => {
    const bytes = await readFile(transparent);
    const result = await compressImageWithDonor47(new Blob([bytes], { type: "image/png" }), { mode: "png-lossless" });
    const opened = await sharp(Buffer.from(await result.blob.arrayBuffer())).ensureAlpha().raw().toBuffer();
    const original = await sharp(bytes).ensureAlpha().raw().toBuffer();
    expect(opened).toEqual(original);
    expect(result).toMatchObject({ mode: "png-lossless", outputMime: "image/png", alphaPolicy: "exact", verification: "exact-filtered-scanlines" });
    expect(result.savedBytes).toBe(bytes.byteLength - result.blob.size);
  });

  it("refuses mode/donor claims that cannot be grounded, mismatched input and cancellation", async () => {
    const bytes = await readFile(transparent);
    const blob = new Blob([bytes], { type: "image/png" });
    await expect(compressImageWithDonor47(blob, { mode: "webp-lossless" as never })).rejects.toThrow(/IMAGE_DONOR_47_UNSUPPORTED_MODE/);
    await expect(compressImageWithDonor47(new Blob([bytes], { type: "image/jpeg" }), { mode: "png-lossless" }))
      .rejects.toThrow(/IMAGE_DONOR_47_TYPE_MISMATCH/);
    const c = new AbortController(); c.abort();
    await expect(compressImageWithDonor47(blob, { mode: "png-lossless", signal: c.signal })).rejects.toMatchObject({ name: "AbortError" });
    await expect(compressImageWithDonor47(new Blob([new Uint8Array([1, 2, 3])]), { mode: "jpeg-normal" }))
      .rejects.toThrow(/IMAGE_DONOR_47_INVALID_INPUT/);
  });
});
