import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { compressImageWithDonor47 } from "../src/engines/image/compression-donor-047";
import { verifyCodecReadback367 } from "../scripts/donor-codecs-367";

const fixture = (name: string) => resolve(import.meta.dirname, `../quality/fixtures/image-metadata/${name}`);

describe("#367 real codec byte readback at a public output seam", () => {
  it("independently reopens a local lossless PNG and preserves all RGBA pixels", async () => {
    const input = await readFile(fixture("transparent-2x2-rgba.png"));
    const result = await compressImageWithDonor47(new Blob([input], { type: "image/png" }), { mode: "png-lossless" });
    const verified = await verifyCodecReadback367(Buffer.from(await result.blob.arrayBuffer()), "image/png", {
      width: 2, height: 2, source: input, requirePixelsExact: true,
    });
    expect(verified.width).toBe(2);
    expect(verified.alphaExact).toBe(true);
    expect(verified.pixelsExact).toBe(true);
    expect(verified.sha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects format spoofing even when a supplied MIME claims JPEG", async () => {
    const bytes = await readFile(fixture("transparent-2x2-rgba.png"));
    await expect(verifyCodecReadback367(bytes, "image/jpeg", { width: 2, height: 2 }))
      .rejects.toThrow(/FORMAT_MISMATCH/u);
  });

  it("rejects truncated output and dimension lies with decoder readback", async () => {
    const bytes = await readFile(fixture("transparent-2x2-rgba.png"));
    await expect(verifyCodecReadback367(bytes.subarray(0, 28), "image/png", { width: 2, height: 2 }))
      .rejects.toThrow(/DECODE_FAILED/u);
    await expect(verifyCodecReadback367(bytes, "image/png", { width: 3, height: 2 }))
      .rejects.toThrow(/DIMENSION_MISMATCH/u);
  });

  it("rejects alpha loss independently of image size and MIME", async () => {
    const source = await readFile(fixture("transparent-2x2-rgba.png"));
    const opaque = await sharp(source).flatten({ background: "white" }).png().toBuffer();
    await expect(verifyCodecReadback367(opaque, "image/png", { width: 2, height: 2, source }))
      .rejects.toThrow(/ALPHA_MISMATCH/u);
  });
});
