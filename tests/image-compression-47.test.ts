import { describe, expect, it } from "vitest";
import { unzlibSync, zlibSync } from "fflate";
import {
  compressPngLossless47, probeImageCompression47,
  PNG_47_MAX_INPUT_BYTES, PNG_47_MAX_PIXELS,
} from "../src/engines/image/png-lossless-47";

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name: string, payload: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(payload.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, payload.length, false);
  bytes.set(new TextEncoder().encode(name), 4);
  bytes.set(payload, 8);
  view.setUint32(bytes.length - 4, crc32(bytes.subarray(4, bytes.length - 4)), false);
  return bytes;
}

function merge(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let i = 0;
  for (const part of parts) { output.set(part, i); i += part.length; }
  return output;
}

function blob(bytes: Uint8Array): Blob {
  // Copy into an ArrayBuffer-owned view for strict TypeScript DOM BlobPart.
  return new Blob([new Uint8Array(bytes)]);
}

function fixture(width = 128, height = 128, rgba = true, level: 0 | 1 | 9 = 0, extra: Uint8Array[] = []): Uint8Array {
  const pixels = new Uint8Array(height * (1 + width * (rgba ? 4 : 3)));
  for (let row = 0; row < height; row++) {
    const stride = 1 + width * (rgba ? 4 : 3);
    pixels[row * stride] = 0; // PNG filter NONE.
    for (let col = 0; col < width; col++) {
      const pos = row * stride + 1 + col * (rgba ? 4 : 3);
      pixels[pos] = row & 255;
      pixels[pos + 1] = col & 255;
      pixels[pos + 2] = 10;
      if (rgba) pixels[pos + 3] = (row + col) & 255;
    }
  }
  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, width, false);
  header.setUint32(4, height, false);
  ihdr[8] = 8; ihdr[9] = rgba ? 6 : 2;
  const encoded = zlibSync(pixels, { level });
  return merge(
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), ...extra, chunk("IDAT", encoded), chunk("IEND", new Uint8Array()),
  );
}

function pngParts(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result: Array<{ name: string; data: Uint8Array }> = [];
  for (let at = 8; at < bytes.length;) {
    const length = view.getUint32(at, false);
    result.push({ name: new TextDecoder().decode(bytes.subarray(at + 4, at + 8)), data: bytes.slice(at + 8, at + 8 + length) });
    at += length + 12;
  }
  return result;
}

function scanlines(bytes: Uint8Array): Uint8Array {
  const idat = merge(...pngParts(bytes).filter((c) => c.name === "IDAT").map((c) => c.data));
  return unzlibSync(idat);
}

describe("#047 verified PNG lossless subset and fail-closed codec matrix", () => {
  it("advertises only proven PNG path, refuses JPEG/WebP expert options and SVG #209", () => {
    const caps = probeImageCompression47();
    expect(caps["image/png"]).toMatchObject({ supported: true, mode: "verified-png-idat-lossless" });
    for (const mime of ["image/jpeg", "image/webp", "image/svg+xml"] as const) {
      expect(caps[mime].supported).toBe(false);
      expect(caps[mime].mode).toBe("refused");
    }
    expect(caps["image/svg+xml"].reason).toMatch(/#209/);
    expect(caps["image/webp"].reason).toMatch(/#207/);
  });

  it("really shrinks RGB and RGBA uncompressed PNG, keeps exact scanlines, ancillary metadata and byte accounting", async () => {
    for (const rgba of [false, true]) {
      const note = chunk("tEXt", new TextEncoder().encode("Comment\0Proof alpha 8-bit"));
      const source = fixture(128, 128, rgba, 0, [note]);
      const result = await compressPngLossless47(blob(source));
      const bytes = new Uint8Array(await result.blob.arrayBuffer());
      expect(result).toMatchObject({
        inputMime: "image/png", outputMime: "image/png", width: 128, height: 128,
        hasAlphaChannel: rgba, pixelVerification: "exact-filtered-scanlines", keptOriginal: false,
      });
      expect(result.savedBytes).toBeGreaterThan(1000);
      expect(result.originalBytes).toBe(source.length);
      expect(result.outputBytes).toBe(bytes.length);
      expect(result.originalBytes - result.outputBytes).toBe(result.savedBytes);
      expect(result.savedPercent).toBeCloseTo(100 * result.savedBytes / source.length, 1);
      expect(scanlines(bytes)).toEqual(scanlines(source));
      expect(pngParts(bytes).find((c) => c.name === "tEXt")!.data).toEqual(note.subarray(8, -4));
      expect(bytes.subarray(0, 8)).toEqual(source.subarray(0, 8));
    }
  });

  it("keeps smaller validated source instead of making a fake compression saving", async () => {
    const source = fixture(16, 16, true, 9);
    const result = await compressPngLossless47(blob(source));
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    expect(result.savedBytes).toBeGreaterThanOrEqual(0);
    expect(result.outputBytes).toBeLessThanOrEqual(source.length);
    if (result.keptOriginal) expect(bytes).toEqual(source);
    expect(scanlines(bytes)).toEqual(scanlines(source));
  });

  it("refuses malformed PNG signatures, CRC, compression streams, unknown critical chunks and palette/APNG", async () => {
    const original = fixture(4, 4);
    const changed = (at: number, byte: number) => {
      const clone = original.slice(); clone[at] = byte; return blob(clone);
    };
    await expect(compressPngLossless47(changed(0, 0))).rejects.toThrow(/INPUT_LIMIT/);
    await expect(compressPngLossless47(changed(17, 255))).rejects.toThrow(/INVALID_CRC/);
    await expect(compressPngLossless47(changed(44, 123))).rejects.toThrow(/INVALID_CRC/);
    const invalidHeader = original.slice();
    const idatLocation = 8 + 12 + 13;
    invalidHeader[idatLocation + 4] = 65; // "ADAT" unknown critical.
    const newCrc = crc32(invalidHeader.subarray(idatLocation + 4, original.length - 16));
    new DataView(invalidHeader.buffer).setUint32(original.length - 16, newCrc, false);
    await expect(compressPngLossless47(blob(invalidHeader))).rejects.toThrow(/UNSUPPORTED_VARIANT/);
    const badPalette = fixture(2, 2, false, 0, [chunk("acTL", new Uint8Array(8))]);
    await expect(compressPngLossless47(blob(badPalette))).rejects.toThrow(/UNSUPPORTED_VARIANT/);
    const badColor = original.slice();
    badColor[25] = 3;
    const validCRC = crc32(badColor.subarray(12, 29));
    new DataView(badColor.buffer).setUint32(29, validCRC, false);
    await expect(compressPngLossless47(blob(badColor))).rejects.toThrow(/UNSUPPORTED_VARIANT/);
  });

  it("caps memory and dimensions before inflate; aborts before and during parsing", async () => {
    expect(PNG_47_MAX_INPUT_BYTES).toBe(4 * 1024 * 1024);
    expect(PNG_47_MAX_PIXELS).toBe(1_000_000);
    const huge = fixture(1024, 1024, false, 9);
    await expect(compressPngLossless47(blob(huge))).rejects.toThrow(/PIXEL_LIMIT/);
    const aborted = new AbortController(); aborted.abort();
    await expect(compressPngLossless47(blob(fixture()), aborted.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
