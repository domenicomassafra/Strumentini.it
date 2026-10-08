import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { unzipSync, zipSync } from "fflate";
import { analyzeOoxmlPackage, OoxmlPackageError } from "../src/engines/ooxml/package";
import { compressOoxmlEmbeddedMedia, type OoxmlMediaCodec } from "../src/engines/ooxml/media-compress";

const root = "tests/ooxml-media-fixtures/";
const codec: OoxmlMediaCodec = async (bytes, mime, options) => {
  const source = sharp(Buffer.from(bytes)).resize(options.targetWidth, options.targetHeight);
  const encoded = mime === "image/png"
    ? await source.png({ compressionLevel: 9 }).toBuffer()
    : await source.jpeg({ quality: Math.round(options.jpegQuality * 100) }).toBuffer();
  return new Uint8Array(encoded);
};
async function fixture(kind: "docx" | "pptx" | "xlsx") {
  return new Uint8Array(await readFile(`${root}embedded.${kind}`));
}

function bytesEqual(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
function changed(original: Uint8Array, modified: Uint8Array) {
  const a = unzipSync(original);
  const b = unzipSync(modified);
  expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
  for (const [path, bytes] of Object.entries(a)) {
    if (/(?:^|\/)media\//u.test(path)) continue;
    expect(bytesEqual(b[path]!, bytes), path).toBe(true);
  }
  return { a, b };
}

describe("264 — bounded OOXML embedded media compression", () => {
  for (const kind of ["docx", "pptx", "xlsx"] as const) {
    it(`${kind}: changes genuine Office-owned PNG losslessly and requires opt-in for JPEG`, async () => {
      const original = await fixture(kind);
      const output = await compressOoxmlEmbeddedMedia(original, {}, codec);
      expect(output.outcome).toBe("optimized");
      expect(output.input.kind).toBe(kind);
      expect(output.output.kind).toBe(kind);
      expect(output.byteLength).toBeLessThan(original.length);
      expect(output.savedBytes).toBeGreaterThan(0);
      expect(output.changedCount).toBe(1);
      expect(output.skippedCount).toBe(1);
      expect(output.parts).toContainEqual(expect.objectContaining({ type: "png", status: "changed", fidelity: "decoded-rgba-identical" }));
      expect(output.parts).toContainEqual(expect.objectContaining({ type: "jpeg", status: "skipped", skipReason: "lossy-approval-required" }));
      expect(output.verification).toMatchObject({
        samePartNames: true, allNonMediaBytesIdentical: true, relationshipBytesIdentical: true,
        contentTypesBytesIdentical: true, structuralCountsIdentical: true, changedMediaOriginalMimePreserved: true,
        independentUnzipReopen: true, pngDecodedPixelsIdenticalUnlessResizeApproved: "not-proven-custom-codec",
      });
      const { a, b } = changed(original, new Uint8Array(output.bytes));
      const path = output.parts.find((p) => p.type === "png")!.path;
      const before = await sharp(Buffer.from(a[path]!)).raw().toBuffer();
      const after = await sharp(Buffer.from(b[path]!)).raw().toBuffer();
      expect(bytesEqual(before, after), "lossless PNG decoded pixels").toBe(true);
    });
    it(`${kind}: reencodes JPEG only with explicit approval; package and relationships remain valid`, async () => {
      const original = await fixture(kind);
      const output = await compressOoxmlEmbeddedMedia(original, { approveLossyJpeg: true, jpegQuality: 0.65 }, codec);
      expect(output.outcome).toBe("optimized");
      expect(output.changedCount).toBe(2);
      expect(output.parts.find((p) => p.type === "jpeg")).toMatchObject({ status: "changed", fidelity: "approved-lossy-recode-or-resize" });
      expect(output.fidelityWarning).toMatch(/APPROVED LOSSY/u);
      const analyzed = analyzeOoxmlPackage(output.bytes);
      expect(analyzed.entryCount).toBe(analyzeOoxmlPackage(original).entryCount);
      changed(original, new Uint8Array(output.bytes));
    });
  }

  it("refuses macro-enabled, encrypted and malicious ZIP paths before any codec invocation", async () => {
    const bytes = await fixture("docx");
    const members = unzipSync(bytes);
    members["word/vbaProject.bin"] = Uint8Array.from([3, 2, 1]);
    const macro = zipSync(members);
    const unsafe = zipSync({ ...unzipSync(bytes), "../escape.png": new Uint8Array([1]) });
    let invoked = 0;
    const noCodec: OoxmlMediaCodec = async () => { invoked += 1; return null; };
    await expect(compressOoxmlEmbeddedMedia(macro, {}, noCodec)).rejects.toMatchObject({ code: "MACRO_PACKAGE_UNSUPPORTED" });
    await expect(compressOoxmlEmbeddedMedia(unsafe, {}, noCodec)).rejects.toMatchObject({ code: "UNSAFE_PACKAGE_PATH" });
    expect(invoked).toBe(0);
  });

  it("skips unsupported/non-Office media and rejects mismatched content-type claims", async () => {
    const bytes = await fixture("docx");
    const members = unzipSync(bytes);
    members["word/media/vector.svg"] = new TextEncoder().encode("<svg/>");
    members["word/media/executable.exe"] = Uint8Array.from([1, 2, 3]);
    const withExtra = await compressOoxmlEmbeddedMedia(zipSync(members), {}, codec);
    expect(withExtra.parts).toContainEqual(expect.objectContaining({ path: "word/media/vector.svg", status: "skipped", skipReason: "unsupported-media" }));
    expect(withExtra.parts).toContainEqual(expect.objectContaining({ path: "word/media/executable.exe", status: "skipped", skipReason: "unsupported-media" }));
    const tampered = unzipSync(bytes);
    tampered["word/media/image1.png"] = Uint8Array.from(await readFile(`${root}media-original.jpg`));
    const mismatched = await compressOoxmlEmbeddedMedia(zipSync(tampered), {}, codec);
    expect(mismatched.parts.find((p) => p.path === "word/media/image1.png")).toMatchObject({ status: "skipped" });
  });

  it("defaults to no-op when transcoding not supported and enforces bounded options", async () => {
    const bytes = await fixture("docx");
    const noOp = await compressOoxmlEmbeddedMedia(bytes, {}, async () => null);
    expect(noOp.outcome).toBe("unchanged");
    expect(noOp.changedCount).toBe(0);
    expect(bytesEqual(bytes, new Uint8Array(noOp.bytes))).toBe(true);
    await expect(compressOoxmlEmbeddedMedia(bytes, { approveResize: true }, codec)).rejects.toBeInstanceOf(OoxmlPackageError);
    await expect(compressOoxmlEmbeddedMedia(bytes, { jpegQuality: NaN }, codec)).rejects.toBeInstanceOf(OoxmlPackageError);
    await expect(compressOoxmlEmbeddedMedia(bytes, { maxMedia: 20 }, codec)).rejects.toBeInstanceOf(OoxmlPackageError);
  });

  it("allows raster downsizing only after explicit resize approval and verifies bounds", async () => {
    const input = await fixture("pptx");
    const result = await compressOoxmlEmbeddedMedia(input, {
      approveResize: true, maxDimension: 160, approveLossyJpeg: true, jpegQuality: 0.65,
    }, codec);
    expect(result.outcome).toBe("optimized");
    expect(result.changedCount).toBe(2);
    expect(result.parts.filter((p) => p.status === "changed")).toEqual(expect.arrayContaining([
      expect.objectContaining({ originalDimensions: expect.objectContaining({ width: 420, height: 280 }), outputDimensions: { width: 160, height: 107 }, fidelity: "approved-lossy-recode-or-resize" }),
    ]));
    expect(result.fidelityWarning).toMatch(/APPROVED LOSSY/u);
    changed(input, new Uint8Array(result.bytes));
  });

  it("refuses media with ambiguous content type rather than rewriting its extension", async () => {
    const original = await fixture("docx");
    const archive = unzipSync(original);
    const types = new TextDecoder().decode(archive["[Content_Types].xml"]!);
    const modified = types.replace('Extension="png" ContentType="image/png"', 'Extension="png" ContentType="image/gif"');
    expect(modified).not.toBe(types);
    archive["[Content_Types].xml"] = new TextEncoder().encode(modified);
    const output = await compressOoxmlEmbeddedMedia(zipSync(archive), { approveLossyJpeg: true }, codec);
    expect(output.parts.find((p) => p.type === "unsupported")).toMatchObject({ status: "skipped", skipReason: "unrecognized-content-type" });
  });

  it("honors abort before decoding and return, without issuing partial package", async () => {
    const bytes = await fixture("pptx");
    const controller = new AbortController();
    controller.abort();
    await expect(compressOoxmlEmbeddedMedia(bytes, { signal: controller.signal }, codec)).rejects.toMatchObject({ name: "AbortError" });
  });
});
