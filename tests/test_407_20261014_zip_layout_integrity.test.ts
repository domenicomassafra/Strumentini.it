import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { analyzeOoxmlPackage, OoxmlPackageError } from "../src/engines/ooxml/package";

function fixture(): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/document.xml": strToU8("<w:document/>"),
    "word/media/first.bin": Uint8Array.of(7, 8, 9),
    "word/media/second.bin": Uint8Array.of(10, 11, 12),
  }, { level: 0 });
}

function metadata(bytes: Uint8Array): { centralOffset: number; eocd: number; entries: Map<string, { central: number; local: number; packed: number }> } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const centralOffset = view.getUint32(eocd + 16, true);
  let cursor = centralOffset;
  const entries = new Map<string, { central: number; local: number; packed: number }>();
  for (let index = 0; index < view.getUint16(eocd + 10, true); index++) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50);
    const nameLength = view.getUint16(cursor + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    entries.set(name, { central: cursor, local: view.getUint32(cursor + 42, true), packed: view.getUint32(cursor + 20, true) });
    cursor += 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
  }
  return { centralOffset, eocd, entries };
}

function payloadStart(bytes: Uint8Array, local: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
}

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

describe("#407 ZIP local layout integrity before OOXML materialization", () => {
  it("rejects two central entries whose local records overlap despite valid stored payload CRCs", () => {
    const bytes = fixture();
    const { entries } = metadata(bytes);
    const first = entries.get("word/media/first.bin")!;
    const second = entries.get("word/media/second.bin")!;
    const firstStart = payloadStart(bytes, first.local);
    const secondEnd = payloadStart(bytes, second.local) + second.packed;
    const forgedSize = secondEnd - firstStart;
    const forgedCrc = crc32(bytes.subarray(firstStart, secondEnd));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint32(first.central + 16, forgedCrc, true);
    view.setUint32(first.local + 14, forgedCrc, true);
    for (const offset of [first.central + 20, first.central + 24, first.local + 18, first.local + 22]) {
      view.setUint32(offset, forgedSize, true);
    }
    expect(forgedSize).toBeGreaterThan(first.packed);
    expect(() => analyzeOoxmlPackage(bytes)).toThrowError(expect.objectContaining<Partial<OoxmlPackageError>>({ code: "CORRUPT_PACKAGE" }));
  });

  it("rejects a bit-3 flag claiming a data descriptor that does not exist", () => {
    const bytes = fixture();
    const last = metadata(bytes).entries.get("word/media/second.bin")!;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint16(last.local + 6, view.getUint16(last.local + 6, true) | 8, true);
    view.setUint16(last.central + 8, view.getUint16(last.central + 8, true) | 8, true);
    for (const offset of [last.local + 14, last.local + 18, last.local + 22]) view.setUint32(offset, 0, true);
    expect(() => analyzeOoxmlPackage(bytes)).toThrowError(expect.objectContaining<Partial<OoxmlPackageError>>({ code: "CORRUPT_PACKAGE" }));
  });

  it("accepts a valid signed bit-3 data descriptor and keeps ordinary DOCX valid", () => {
    const ordinary = fixture();
    const original = metadata(ordinary);
    const last = original.entries.get("word/media/second.bin")!;
    expect(payloadStart(ordinary, last.local) + last.packed).toBe(original.centralOffset);
    const before = new DataView(ordinary.buffer, ordinary.byteOffset, ordinary.byteLength);
    const descriptor = new Uint8Array(16);
    const desc = new DataView(descriptor.buffer);
    desc.setUint32(0, 0x08074b50, true);
    desc.setUint32(4, before.getUint32(last.central + 16, true), true);
    desc.setUint32(8, last.packed, true);
    desc.setUint32(12, before.getUint32(last.central + 24, true), true);
    const bytes = new Uint8Array(ordinary.length + descriptor.length);
    bytes.set(ordinary.subarray(0, original.centralOffset));
    bytes.set(descriptor, original.centralOffset);
    bytes.set(ordinary.subarray(original.centralOffset), original.centralOffset + descriptor.length);
    const view = new DataView(bytes.buffer);
    view.setUint32(original.eocd + descriptor.length + 16, original.centralOffset + descriptor.length, true);
    view.setUint16(last.local + 6, view.getUint16(last.local + 6, true) | 8, true);
    for (const offset of [last.local + 14, last.local + 18, last.local + 22]) view.setUint32(offset, 0, true);
    view.setUint16(last.central + descriptor.length + 8, view.getUint16(last.central + descriptor.length + 8, true) | 8, true);
    expect(analyzeOoxmlPackage(ordinary).kind).toBe("docx");
    expect(analyzeOoxmlPackage(bytes)).toMatchObject({ kind: "docx", entryCount: 4 });
  });
});
