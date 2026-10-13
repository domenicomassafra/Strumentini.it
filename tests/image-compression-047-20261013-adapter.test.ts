import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { compressImageWithDonor47, DONOR_47_CAPABILITIES } from "../src/engines/image/compression-donor-047";

const width = 96;
const height = 64;

function rgbaPixels(exact: boolean): Buffer {
  const bytes = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    bytes[i * 4] = exact ? (x % 3) * 75 : (x * 17 + y * 5) & 255;
    bytes[i * 4 + 1] = exact ? (y % 3) * 70 : (x * 9 + y * 21) & 255;
    bytes[i * 4 + 2] = exact ? 22 : (x * 7 + y * 13) & 255;
    bytes[i * 4 + 3] = [0, 77, 191, 255][(x + y) % 4]!;
  }
  return bytes;
}

async function sourcePng(exact: boolean): Promise<{ bytes: Buffer; pixels: Buffer }> {
  const pixels = rgbaPixels(exact);
  const bytes = await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 0, palette: false }).toBuffer();
  return { bytes, pixels };
}

describe("#047 actual installed PNG palette donor adapter", () => {
  it("exposes available palette exact and lossy codecs as real modes", () => {
    expect(DONOR_47_CAPABILITIES.pngPaletteExact).toMatchObject({ supported: true, codec: "fflate" });
    expect(DONOR_47_CAPABILITIES.pngPaletteLossy).toMatchObject({ supported: true, codec: "fflate" });
  });

  it.each([
    ["png-palette-exact", true],
    ["png-palette-lossy", false],
  ] as const)("%s produces signed smaller indexed PNG with byte-exact alpha", async (mode, exact) => {
    const source = await sourcePng(exact);
    const result = await compressImageWithDonor47(new Blob([new Uint8Array(source.bytes)], { type: "image/png" }), { mode });
    const exported = Buffer.from(await result.blob.arrayBuffer());
    const checked = await sharp(exported).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(result).toMatchObject({
      mode, inputMime: "image/png", outputMime: "image/png", codec: "fflate",
      width, height, originalBytes: source.bytes.length, outputBytes: exported.length,
      savedBytes: source.bytes.length - exported.length, keptOriginal: false,
      verification: "strict-png-reparse-and-alpha", alphaPolicy: "exact",
      pixelPolicy: exact ? "exact" : "lossy-rgb",
    });
    expect(result.paletteColors).toBeGreaterThan(0);
    expect(result.maxObservedChannelError).toBeLessThanOrEqual(exact ? 0 : 32);
    expect(exported.length).toBeLessThan(source.bytes.length);
    expect(checked.info).toMatchObject({ width, height, channels: 4 });
    for (let i = 0; i < source.pixels.length; i++) {
      if (i % 4 === 3 || exact) expect(checked.data[i]).toBe(source.pixels[i]);
      else expect(Math.abs(checked.data[i]! - source.pixels[i]!)).toBeLessThanOrEqual(32);
    }
    // Signed bytes are real; the encoded PNG IHDR color type is indexed (3).
    expect(exported[25]).toBe(3);
  });

  it("refuses unsupported quality and non-PNG input for palette modes", async () => {
    const { bytes } = await sourcePng(true);
    const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
    await expect(compressImageWithDonor47(blob, { mode: "png-palette-exact", qualityHint: 0.6 }))
      .rejects.toThrow(/IMAGE_DONOR_47_INVALID_QUALITY/u);
    await expect(compressImageWithDonor47(blob, { mode: "png-palette-lossy", signal: AbortSignal.abort() }))
      .rejects.toMatchObject({ name: "AbortError" });
    await expect(compressImageWithDonor47(new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), { mode: "png-palette-lossy" }))
      .rejects.toThrow(/IMAGE_DONOR_47_TYPE_MISMATCH/u);
  });
});
