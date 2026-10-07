import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { unzipSync, zipSync, type Zippable } from "fflate";
import { OoxmlPackageError, analyzeOoxmlPackage } from "../src/engines/ooxml/package";
import { rebuildOoxmlPackage } from "../src/engines/ooxml/package-codec";

function exactBytes(bytes: Buffer): Uint8Array {
  return new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function minimalDocx(extra: Record<string, Uint8Array> = {}): Uint8Array {
  const encoder = new TextEncoder();
  const entries: Zippable = {
    "[Content_Types].xml": encoder.encode("<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>"),
    "_rels/.rels": encoder.encode("<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"officeDocument\" Target=\"word/document.xml\"/></Relationships>"),
    "word/document.xml": encoder.encode("<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body/></w:document>"),
    ...extra,
  };
  return zipSync(entries, { level: 9 });
}

function markFirstEntryEncrypted(source: Uint8Array): Uint8Array {
  const bytes = source.slice();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let local = -1;
  let central = -1;
  for (let offset = 0; offset + 4 <= bytes.byteLength; offset += 1) {
    const signature = view.getUint32(offset, true);
    if (local < 0 && signature === 0x04034b50) local = offset;
    if (central < 0 && signature === 0x02014b50) central = offset;
    if (local >= 0 && central >= 0) break;
  }
  if (local < 0 || central < 0) throw new Error("Fixture ZIP headers not found.");
  view.setUint16(local + 6, view.getUint16(local + 6, true) | 1, true);
  view.setUint16(central + 8, view.getUint16(central + 8, true) | 1, true);
  return bytes;
}

describe("ticket 225 — bounded OOXML package analysis and DEFLATE rebuild", () => {
  it("accepts the pinned real ISTAT XLSX inside the bounded package policy", async () => {
    const source = exactBytes(await readFile("quality/reference-data/italy/artifacts/115-administrative-geography/istat-elenco-comuni-2026-02-21.xlsx"));
    const analysis = analyzeOoxmlPackage(source);
    expect(analysis).toMatchObject({ kind: "xlsx", entryCount: 18, sheetCount: 3, totalUncompressedBytes: 9_429_339 });
    expect(Math.max(...analysis.entries.map(({ expansionRatio }) => expansionRatio))).toBeLessThan(13);
  });

  for (const fixture of ["sample.xlsx", "sample.docx", "sample.pptx"] as const) {
    it(`rebuilds ${fixture} with DEFLATE while preserving every member byte and package structure`, async () => {
      const source = exactBytes(await readFile(`spikes/heavy-local-feasibility/public/corpus/${fixture}`));
      const before = analyzeOoxmlPackage(source);
      const result = await rebuildOoxmlPackage(source);
      const after = analyzeOoxmlPackage(result.bytes);
      const sourceMembers = unzipSync(source);
      const outputMembers = unzipSync(new Uint8Array(result.bytes));

      expect(result.verification).toMatchObject({
        memberSetUnchanged: true,
        memberBytesUnchanged: true,
        relationshipBytesUnchanged: true,
        contentTypesBytesUnchanged: true,
        structuralCountsUnchanged: true,
        outputCompression: "deflate",
      });
      expect(after.entries.every(({ compressionMethod }) => compressionMethod === 8)).toBe(true);
      expect(after).toMatchObject({
        kind: before.kind,
        entryCount: before.entryCount,
        documentCount: before.documentCount,
        slideCount: before.slideCount,
        sheetCount: before.sheetCount,
        relationshipPartCount: before.relationshipPartCount,
      });
      expect(Object.keys(outputMembers).toSorted()).toEqual(Object.keys(sourceMembers).toSorted());
      for (const path of Object.keys(sourceMembers)) expect(sameBytes(sourceMembers[path]!, outputMembers[path]!)).toBe(true);
      expect(result.sizeOutcome).toBe(result.byteLength < result.inputByteLength ? "smaller" : result.byteLength > result.inputByteLength ? "larger" : "same");
    });
  }

  it("refuses traversal before decompression", () => {
    const archive = minimalDocx({ "../escape.txt": new TextEncoder().encode("escape") });
    expect(() => analyzeOoxmlPackage(archive)).toThrowError(expect.objectContaining<Partial<OoxmlPackageError>>({ code: "UNSAFE_PACKAGE_PATH" }));
  });

  it("refuses high-ratio members before materializing their expanded bytes", () => {
    const archive = minimalDocx({ "word/huge.xml": new Uint8Array(2 * 1024 * 1024) });
    expect(() => analyzeOoxmlPackage(archive)).toThrowError(expect.objectContaining<Partial<OoxmlPackageError>>({ code: "EXPANSION_LIMIT" }));
  });

  it("refuses macro-enabled OOXML instead of silently preserving active code", () => {
    const archive = minimalDocx({ "word/vbaProject.bin": new Uint8Array([1, 2, 3]) });
    expect(() => analyzeOoxmlPackage(archive)).toThrowError(expect.objectContaining<Partial<OoxmlPackageError>>({ code: "MACRO_PACKAGE_UNSUPPORTED" }));
  });

  it("refuses encrypted/password-protected ZIP members before decompression", () => {
    const encrypted = markFirstEntryEncrypted(minimalDocx());
    expect(() => analyzeOoxmlPackage(encrypted)).toThrowError(expect.objectContaining<Partial<OoxmlPackageError>>({ code: "ENCRYPTED_PACKAGE_UNSUPPORTED" }));
  });

  it("preserves inert external relationships byte-for-byte and never resolves them", async () => {
    const rel = new TextEncoder().encode("<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId9\" Target=\"https://example.invalid/resource\" TargetMode=\"External\" Type=\"hyperlink\"/></Relationships>");
    const archive = minimalDocx({ "word/_rels/document.xml.rels": rel });
    const result = await rebuildOoxmlPackage(archive);
    expect(result.verification.externalRelationshipsPreservedInert).toBe(1);
    const reopened = unzipSync(new Uint8Array(result.bytes));
    expect(sameBytes(reopened["word/_rels/document.xml.rels"]!, rel)).toBe(true);
  });
});
