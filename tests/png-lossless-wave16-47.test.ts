import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { compressPngLossless47 } from "../src/engines/image/png-lossless-47";

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function realPng(): Promise<Buffer> {
  const width = 64;
  const height = 48;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = (i * 7) & 255;
    rgba[i * 4 + 1] = (i * 13) & 255;
    rgba[i * 4 + 2] = 191;
    rgba[i * 4 + 3] = (i * 31) & 255;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 0 }).toBuffer();
}

function corruptAdlerPreservingPngCrc(source: Buffer): Buffer {
  const bytes = Buffer.from(source);
  let lastIdat: { offset: number; end: number; length: number } | undefined;
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const name = bytes.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (name === "IDAT") lastIdat = { offset, end, length };
    offset = end;
  }
  expect(lastIdat).toBeDefined();
  const { offset, end, length } = lastIdat!;
  expect(length).toBeGreaterThanOrEqual(4);
  // zlib Adler-32 ends the concatenated IDAT stream, potentially split among
  // several PNG IDAT chunks (as it is by this independent Sharp fixture).
  bytes[end - 5] = bytes[end - 5]! ^ 1;
  bytes.writeUInt32BE(crc32(bytes.subarray(offset + 4, end - 4)), end - 4);
  return bytes;
}

describe("#047 PNG IDAT zlib integrity — independent Sharp reopening", () => {
  it("fails closed for a changed Adler-32 even when all PNG chunk CRCs are valid", async () => {
    const original = await realPng();
    const corrupted = corruptAdlerPreservingPngCrc(original);
    expect(await sharp(original).ensureAlpha().raw().toBuffer()).toHaveLength(64 * 48 * 4);
    await expect(sharp(corrupted).ensureAlpha().raw().toBuffer()).rejects.toThrow();
    await expect(compressPngLossless47(new Blob([new Uint8Array(corrupted)])))
      .rejects.toThrow(/PNG_47_INVALID_ZLIB/u);
  });

  it("accepts checksum-valid PNG and keeps independently decoded RGBA pixels", async () => {
    const original = await realPng();
    const result = await compressPngLossless47(new Blob([new Uint8Array(original)]));
    const output = Buffer.from(await result.blob.arrayBuffer());
    expect(result.savedBytes).toBe(original.length - output.length);
    expect(await sharp(output).ensureAlpha().raw().toBuffer())
      .toEqual(await sharp(original).ensureAlpha().raw().toBuffer());
  });
});
