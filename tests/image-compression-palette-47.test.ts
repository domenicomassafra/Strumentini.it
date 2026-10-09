import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { zlibSync } from "fflate";
import { compressPngLossless47 } from "../src/engines/image/png-lossless-47";

const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name: string, payload: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(12 + payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, payload.length, false);
  bytes.set(new TextEncoder().encode(name), 4);
  bytes.set(payload, 8);
  view.setUint32(bytes.length - 4, crc32(bytes.subarray(4, bytes.length - 4)), false);
  return bytes;
}
function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function indexedOrGray(width: number, height: number, type: 0 | 3 | 4, bits: 1 | 2 | 4 | 8, transparency: boolean): Uint8Array<ArrayBuffer> {
  const channels = type === 4 ? 2 : 1;
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  ihdr[8] = bits;
  ihdr[9] = type;
  const scanlines = new Uint8Array(height * (1 + Math.ceil(width * channels * bits / 8)));
  const paletteSize = 1 << bits;
  for (let row = 0; row < height; row++) {
    const stride = 1 + Math.ceil(width * channels * bits / 8);
    scanlines[row * stride] = 0;
    for (let col = 0; col < width; col++) {
      const index = (col + row) % paletteSize;
      if (bits === 8) {
        scanlines[row * stride + 1 + col * channels] = type === 4 ? (index * 17) & 255 : index;
        if (type === 4) scanlines[row * stride + 2 + col * channels] = (row * 41 + col * 17) & 255;
      } else {
        const bitAt = col * bits;
        scanlines[row * stride + 1 + Math.floor(bitAt / 8)]! |= index << (8 - (bitAt % 8) - bits);
      }
    }
  }
  const palette = new Uint8Array(paletteSize * 3);
  for (let i = 0; i < paletteSize; i++) {
    palette[i * 3] = (i * 43) & 255;
    palette[i * 3 + 1] = (i * 17) & 255;
    palette[i * 3 + 2] = (i * 69) & 255;
  }
  const chunks = [chunk("IHDR", ihdr)];
  if (type === 3) chunks.push(chunk("PLTE", palette));
  if (transparency) chunks.push(chunk("tRNS", type === 3 ? Uint8Array.from({ length: paletteSize }, (_, i) => (i * 255 / Math.max(1, paletteSize - 1)) | 0) : Uint8Array.of(0, 0)));
  chunks.push(chunk("tEXt", new TextEncoder().encode("Comment\u0000indexed/gray proof #047")));
  chunks.push(chunk("IDAT", zlibSync(scanlines, { level: 0 })));
  chunks.push(chunk("IEND", new Uint8Array()));
  return concat([signature, ...chunks]);
}
function parseChunks(bytes: Uint8Array): Array<{ name: string; bytes: Uint8Array }> {
  const list: Array<{ name: string; bytes: Uint8Array }> = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 8; offset < bytes.length;) {
    const length = view.getUint32(offset, false);
    list.push({ name: new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8)), bytes: bytes.slice(offset, offset + 12 + length) });
    offset += 12 + length;
  }
  return list;
}

describe("#047 actual grayscale, indexed palette and tRNS PNG lossless", () => {
  it.each([1, 2, 4, 8] as const)("preserves exact independent decoder RGBA for %i-bit indexed with transparent palette", async (bits) => {
    const input = indexedOrGray(73, 35, 3, bits, true);
    const result = await compressPngLossless47(new Blob([input]));
    const output = new Uint8Array(await result.blob.arrayBuffer());
    expect(result).toMatchObject({ colorType: 3, bitDepth: bits, hasTrnsChunk: true,
      hasAlphaChannel: false, pixelVerification: "exact-filtered-scanlines", keptOriginal: false });
    expect(output.length).toBeLessThan(input.length);
    const a = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(a.info).toMatchObject({ width: 73, height: 35, channels: 4 });
    expect(b.data).toEqual(a.data);
    for (const name of ["PLTE", "tRNS", "tEXt", "IHDR", "IEND"]) {
      expect(parseChunks(output).find((part) => part.name === name)?.bytes).toEqual(parseChunks(input).find((part) => part.name === name)?.bytes);
    }
  });
  it.each([1, 2, 4, 8] as const)("preserves exact independent decoded gray samples for %i-bit grayscale", async (bits) => {
    const input = indexedOrGray(71, 23, 0, bits, false);
    const result = await compressPngLossless47(new Blob([input]));
    const output = new Uint8Array(await result.blob.arrayBuffer());
    expect(result).toMatchObject({ colorType: 0, bitDepth: bits, hasTrnsChunk: false, hasAlphaChannel: false });
    expect(output.length).toBeLessThan(input.length);
    expect((await sharp(output).raw().toBuffer())).toEqual(await sharp(input).raw().toBuffer());
  });
  it("retains actual grayscale alpha values in 8-bit color type 4, not just RGBA color type 6", async () => {
    const input = indexedOrGray(37, 42, 4, 8, false);
    const result = await compressPngLossless47(new Blob([input]));
    const output = new Uint8Array(await result.blob.arrayBuffer());
    expect(result).toMatchObject({ colorType: 4, bitDepth: 8, hasAlphaChannel: true });
    expect(output.length).toBeLessThan(input.length);
    expect(await sharp(output).ensureAlpha().raw().toBuffer()).toEqual(await sharp(input).ensureAlpha().raw().toBuffer());
  });
  it("rejects indexed PNG without a palette, an illegal palette, and malformed tRNS", async () => {
    const base = indexedOrGray(41, 17, 3, 2, true);
    const components = parseChunks(base);
    const build = (parts: readonly { name: string; bytes: Uint8Array }[]) => concat([signature, ...parts.map((p) => p.bytes)]);
    await expect(compressPngLossless47(new Blob([build(components.filter((p) => p.name !== "PLTE"))])))
      .rejects.toThrow(/PNG_47_MALFORMED/u);
    await expect(compressPngLossless47(new Blob([build(components.filter((p) => p.name !== "tRNS").flatMap((p) => [p, ...(p.name === "PLTE" ? [p] : [])]))])))
      .rejects.toThrow(/PNG_47_MALFORMED/u);
    const tooManyAlphaValues = components.flatMap((p) => p.name === "tRNS" ? [] :
      p.name === "IDAT" ? [{ name: "tRNS", bytes: chunk("tRNS", Uint8Array.of(1, 2, 3, 4, 5)) }, p] : [p]);
    await expect(compressPngLossless47(new Blob([build(tooManyAlphaValues)])))
      .rejects.toThrow(/PNG_47_MALFORMED/u);
    const gray = indexedOrGray(27, 13, 0, 1, false);
    const grayParts = parseChunks(gray);
    await expect(compressPngLossless47(new Blob([build(grayParts.flatMap((p) => p.name === "IHDR" ?
      [p, { name: "PLTE", bytes: chunk("PLTE", Uint8Array.of(1, 2, 3)) }] : [p]))])))
      .rejects.toThrow(/PNG_47_MALFORMED/u);
  });
  it("fails closed on interlaced or 16-bit sources rather than presenting them as lossless verified", async () => {
    const source = indexedOrGray(19, 13, 0, 8, false);
    for (const [offset, value] of [[24, 16], [28, 1]] as const) {
      const changed = source.slice();
      changed[offset] = value;
      new DataView(changed.buffer).setUint32(29, crc32(changed.subarray(12, 29)), false);
      await expect(compressPngLossless47(new Blob([changed]))).rejects.toThrow(/PNG_47_UNSUPPORTED_VARIANT/u);
    }
  });
});
