import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scanImageMetadata, scanImageMetadataBlob } from "../src/engines/image/metadata";

const cleanPng = new Uint8Array(readFileSync(new URL("../quality/fixtures/image-metadata-segments/clean.png", import.meta.url)));

// A table-based *test fixture* CRC preserves the exact PNG polynomial and
// bytes. Computing eight bit steps for each of the >8 MiB synthetic IDAT
// bytes made this unit test time out under a shared/CI CPU load.
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ ((value & 1) === 1 ? 0xedb88320 : 0);
  }
  return value >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name: string, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(data.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set(new TextEncoder().encode(name), 4);
  bytes.set(data, 8);
  view.setUint32(data.length + 8, crc32(bytes.subarray(4, data.length + 8)));
  return bytes;
}

function assemble(...pieces: Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
  let offset = 0;
  for (const piece of pieces) {
    joined.set(piece, offset);
    offset += piece.length;
  }
  return joined;
}

function beforeIend(...extra: Uint8Array[]): Uint8Array {
  return assemble(cleanPng.subarray(0, -12), ...extra, cleanPng.subarray(-12));
}

describe("#394 forensic inventory of exported image bytes", () => {
  it("pins the test-fixture PNG CRC polynomial against the standard reference vector", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("identifies XMP inside PNG iTXt, other text, and unknown private ancillary chunks", () => {
    const xmp = chunk("iTXt", new TextEncoder().encode("XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta>synthetic</x:xmpmeta>"));
    const comment = chunk("tEXt", new TextEncoder().encode("Comment\0example"));
    const hidden = chunk("aaAB", new TextEncoder().encode("unknown-private-metadata"));
    const inventory = scanImageMetadata(beforeIend(xmp, comment, hidden));
    expect(inventory.segments.map((item) => `${item.segment}:${item.carrier}`)).toEqual([
      "PNG iTXt:xmp",
      "PNG tEXt:text",
      "PNG aaAB:ancillary",
    ]);
    expect(inventory.complete).toBe(true);
  });

  it("does not certify a PNG with an appended payload or truncated chunk", () => {
    expect(scanImageMetadata(assemble(cleanPng, new TextEncoder().encode("hidden trailer"))).complete).toBe(false);
    expect(scanImageMetadata(cleanPng.subarray(0, -4)).complete).toBe(false);
  });

  it("walks actual Blob boundaries beyond 8 MiB without materializing the entire file", async () => {
    const largePixelChunk = chunk("IDAT", new Uint8Array(8 * 1024 * 1024 + 5));
    const tail = chunk("iTXt", new TextEncoder().encode("XML:com.adobe.xmp\0\0\0\0\0<location>example</location>"));
    const bigPng = assemble(cleanPng.subarray(0, 33), largePixelChunk, tail, cleanPng.subarray(-12));
    const limited = scanImageMetadata(bigPng.subarray(0, 8 * 1024 * 1024));
    expect(limited.complete).toBe(false);
    const inventory = await scanImageMetadataBlob(new Blob([new Uint8Array(bigPng)]));
    expect(inventory.complete).toBe(true);
    expect(inventory.format).toBe("png");
    expect(inventory.segments).toEqual([expect.objectContaining({ segment: "PNG iTXt", carrier: "xmp" })]);
  });

  it("cancels bounded PNG inspection before certifying a result", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(scanImageMetadataBlob(new Blob([cleanPng]), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
