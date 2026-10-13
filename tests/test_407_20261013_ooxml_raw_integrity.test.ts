/** #407 — verify the *actual* ZIP payload before any OOXML engine may unzipSync.
 * Forges metadata of a real CRC-valid DEFLATE stream, leaving its bytes intact.
 */
import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { strToU8, unzipSync, zipSync } from "fflate";
import { analyzeOoxmlPackage, OoxmlPackageError, OOXML_PACKAGE_LIMITS } from "../src/engines/ooxml/package";
import { rebuildOoxmlPackage } from "../src/engines/ooxml/package-codec";

function fixture(valid = false): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    "_rels/.rels": strToU8("<Relationships/>"),
    "word/document.xml": strToU8("<w:document/>"),
    // A real valid package must respect the existing 100:1 expansion bound.
    "word/media/dense.dat": valid ? Uint8Array.from({ length: 8192 }, (_, i) => i % 251) : new Uint8Array(2_000_000),
  }, { level: 9 });
}

function corruptMeta(original: Uint8Array, mode: "central" | "both" | "crc" | "valid"): Uint8Array {
  const bytes = original.slice();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  let cursor = view.getUint32(eocd + 16, true);
  let hit = false;
  for (let i = 0; i < view.getUint16(eocd + 10, true); i++) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50);
    const nameSize = view.getUint16(cursor + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameSize));
    if (name === "word/media/dense.dat") {
      hit = true;
      const compressed = view.getUint32(cursor + 20, true);
      const uncompressed = view.getUint32(cursor + 24, true);
      expect(compressed).toBeGreaterThan(0);
      expect(compressed).toBeLessThan(8_000);
      expect(uncompressed).toBe(mode === "crc" || mode === "valid" ? 8192 : 2_000_000);
      const localOffset = view.getUint32(cursor + 42, true);
      expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
      if (mode === "central" || mode === "both") {
        // 2 MB of zero bytes REALLY inflates from <8KB, but the header now
        // claims an innocent <=8KB result and ~1:1 expansion ratio.
        view.setUint32(cursor + 24, compressed, true);
        if (mode === "both") view.setUint32(localOffset + 22, compressed, true);
      } else if (mode === "crc") {
        const forged = (view.getUint32(cursor + 16, true) ^ 0xffffffff) >>> 0;
        view.setUint32(cursor + 16, forged, true);
        view.setUint32(localOffset + 14, forged, true);
      }
      break;
    }
    cursor += 46 + nameSize + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
  }
  expect(hit).toBe(true);
  return bytes;
}

function independentDenseInflate(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = view.getUint32(bytes.length - 22 + 16, true);
  for (let i = 0; i < view.getUint16(bytes.length - 22 + 10, true); i++) {
    const nameSize = view.getUint16(cursor + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameSize));
    if (name === "word/media/dense.dat") {
      const local = view.getUint32(cursor + 42, true);
      const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const packed = bytes.subarray(dataStart, dataStart + view.getUint32(cursor + 20, true));
      return new Uint8Array(inflateRawSync(packed, { maxOutputLength: 3_000_000 }));
    }
    cursor += 46 + nameSize + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
  }
  throw new Error("Independent inflate fixture ZIP member is missing.");
}

describe("#407 direct OOXML DEFLATE integrity before materialization", () => {
  it.each(["central", "both"] as const)("rejects true 2MB DEFLATE with %s forged tiny uncompressedSize", async (mode) => {
    const original = fixture();
    const forged = corruptMeta(original, mode);
    expect(forged.length).toBe(original.length);
    // Independent native decompressor proves ZIP's claimed small size is a lie.
    expect(independentDenseInflate(forged).length).toBe(2_000_000);
    // fflate historically trusts the false size and returns a silently
    // truncated output; inspect only the small forged output in the test.
    expect(unzipSync(forged)["word/media/dense.dat"]?.length).toBeLessThan(8_000);
    expect(() => analyzeOoxmlPackage(forged)).toThrowError(
      expect.objectContaining<Partial<OoxmlPackageError>>({ code: mode === "central" ? "CORRUPT_PACKAGE" : "EXPANSION_LIMIT" }),
    );
    await expect(rebuildOoxmlPackage(forged)).rejects.toMatchObject({ code: mode === "central" ? "CORRUPT_PACKAGE" : "EXPANSION_LIMIT" });
  });

  it("refuses a CRC mismatch even when sizes and local/central header CRCs agree", () => {
    const forged = corruptMeta(fixture(true), "crc");
    expect(() => analyzeOoxmlPackage(forged)).toThrowError(
      expect.objectContaining<Partial<OoxmlPackageError>>({ code: "CORRUPT_PACKAGE" }),
    );
  });

  it("refuses a damaged stored member on its actual CRC, before unzipping", () => {
    const bytes = zipSync({
      "[Content_Types].xml": strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
      "word/document.xml": strToU8("<w:document/>"),
    }, { level: 0 });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const firstNameLength = view.getUint16(26, true);
    const dataStart = 30 + firstNameLength + view.getUint16(28, true);
    bytes[dataStart] = bytes[dataStart]! ^ 1;
    expect(() => analyzeOoxmlPackage(bytes)).toThrowError(
      expect.objectContaining<Partial<OoxmlPackageError>>({ code: "CORRUPT_PACKAGE" }),
    );
  });

  it("enforces the 20MB cumulative decoded limit even when each member is individually permitted", () => {
    const media = new Uint8Array(10 * 1024 * 1024);
    let entropy = 0x12345678;
    // Noise every 32 bytes keeps the real compression ratio well below 100:1.
    for (let at = 0; at < media.length; at += 32) {
      entropy ^= entropy << 13;
      entropy ^= entropy >>> 17;
      entropy ^= entropy << 5;
      media[at] = entropy & 255;
    }
    const bytes = zipSync({
      "[Content_Types].xml": strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
      "word/document.xml": strToU8("<w:document/>"),
      "word/media/one.bin": media,
      "word/media/two.bin": media,
    }, { level: 1 });
    expect(bytes.byteLength).toBeLessThan(OOXML_PACKAGE_LIMITS.maxInputBytes);
    expect(() => analyzeOoxmlPackage(bytes)).toThrowError(
      expect.objectContaining<Partial<OoxmlPackageError>>({ code: "EXPANSION_LIMIT" }),
    );
  });

  it("valid same-document OOXML member bytes remain exact through analyzer and rebuild", async () => {
    const bytes = corruptMeta(fixture(true), "valid");
    const originalMembers = unzipSync(bytes);
    expect(analyzeOoxmlPackage(bytes)).toMatchObject({ kind: "docx", entryCount: 4 });
    const rebuilt = await rebuildOoxmlPackage(bytes);
    const roundtrip = unzipSync(new Uint8Array(rebuilt.bytes));
    expect(Object.keys(roundtrip).sort()).toEqual(Object.keys(originalMembers).sort());
    for (const name of Object.keys(roundtrip)) expect(roundtrip[name]).toEqual(originalMembers[name]);
  });
});
