import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { encodePortraitPng274 } from "../src/engines/image/portrait-modnet-png-274";

function decodeExactRgba(png: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  const compressed: Uint8Array[] = [];
  const kinds: string[] = [];
  while (offset < png.byteLength) {
    const length = view.getUint32(offset, false);
    const kind = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    expect(end).toBeLessThanOrEqual(png.byteLength);
    let crc = 0xffffffff;
    for (let at = offset + 4; at < end - 4; at++) {
      crc ^= png[at]!;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    expect(view.getUint32(end - 4, false)).toBe((crc ^ 0xffffffff) >>> 0);
    kinds.push(kind);
    if (kind === "IHDR") {
      expect(length).toBe(13);
      width = view.getUint32(offset + 8, false);
      height = view.getUint32(offset + 12, false);
      expect(Array.from(png.subarray(offset + 16, offset + 21))).toEqual([8, 6, 0, 0, 0]);
    } else if (kind === "IDAT") compressed.push(png.slice(offset + 8, end - 4));
    offset = end;
  }
  expect(kinds).toEqual(["IHDR", "IDAT", "IEND"]);
  const raw = inflateSync(Buffer.concat(compressed));
  expect(raw.byteLength).toBe(height * (1 + width * 4));
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    expect(raw[y * (1 + width * 4)]).toBe(0);
    pixels.set(raw.subarray(y * (1 + width * 4) + 1, (y + 1) * (1 + width * 4)), y * width * 4);
  }
  return { width, height, pixels };
}

describe("#274 PNG encoder without Blob I/O", () => {
  it("decodes RGBA bytes independently and retains 0/partial/255 alpha exactly", () => {
    const original = new Uint8ClampedArray([12, 99, 220, 0, 38, 52, 104, 100, 255, 12, 15, 255, 4, 5, 6, 127]);
    const png = new Uint8Array(encodePortraitPng274(original, 2, 2));
    const decoded = decodeExactRgba(png);
    expect([decoded.width, decoded.height]).toEqual([2, 2]);
    expect(Array.from(decoded.pixels)).toEqual(Array.from(original));
  });

  it("rejects invalid pixel lengths, excessive dimensions and invalid sizes", () => {
    expect(() => encodePortraitPng274(new Uint8ClampedArray(8), 2, 2)).toThrow("PNG_INPUT_INVALID");
    expect(() => encodePortraitPng274(new Uint8ClampedArray(), 0, 1)).toThrow("PNG_INPUT_INVALID");
    expect(() => encodePortraitPng274(new Uint8ClampedArray(), 1601, 10)).toThrow("PNG_INPUT_INVALID");
  });
});
