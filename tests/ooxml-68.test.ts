import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { unzipSync, zipSync } from "fflate";
import { analyzeOoxmlPackage } from "../src/engines/ooxml/package";
import { compareOoxmlZipGroups, summarizeOoxmlZipGroups, OOXML_ZIP_GROUPS } from "../src/engines/ooxml/compression-groups";
import {
  compressOoxmlEmbeddedMedia, OOXML_COMPRESSION_PROFILE_DEFAULT_JPEG_QUALITY,
  type OoxmlMediaCodec,
} from "../src/engines/ooxml/media-compress";

const corpusPath = "tests/ooxml-68-corpus";
const codec: OoxmlMediaCodec = async (source, mime, options) => {
  const instance = sharp(Buffer.from(source)).resize(options.targetWidth, options.targetHeight);
  const encoded = mime === "image/png"
    ? await instance.png({ compressionLevel: 9 }).toBuffer()
    : mime === "image/webp"
      ? await instance.webp({ quality: Math.round(options.jpegQuality * 100) }).toBuffer()
      : await instance.jpeg({ quality: Math.round(options.jpegQuality * 100) }).toBuffer();
  return new Uint8Array(encoded);
};
const get = async (extension: string) => new Uint8Array(await readFile(`${corpusPath}/complex.${extension}`));
const identical = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

describe("#68 ZIP groups and approved raster profiles", () => {
  for (const kind of ["docx", "pptx", "xlsx"] as const) {
    it(`${kind}: measures real ZIP compressed media/XML/font/other, correctly includes archive overhead`, async () => {
      const source = await get(kind);
      const report = summarizeOoxmlZipGroups(analyzeOoxmlPackage(source), source.length);
      expect(report.fileBytes).toBe(source.byteLength);
      expect(report.memberBytes + report.containerOverheadBytes).toBe(source.length);
      expect(report.containerOverheadBytes).toBeGreaterThan(0);
      expect(OOXML_ZIP_GROUPS.map((name) => report.groups[name].packedBytes).reduce((a, b) => a + b, 0)).toBe(report.memberBytes);
      expect(report.groups.media.members).toBe(2);
      expect(report.groups.xml.members).toBeGreaterThan(0);
      expect(report.groups.xml.packedBytes).toBeGreaterThan(0);
      const result = await compressOoxmlEmbeddedMedia(source, { profile: "balanced", approveLossyJpeg: true }, codec);
      expect(result.outcome).toBe("optimized");
      expect(result.bytes.byteLength).toBeLessThan(source.byteLength);
      expect(result.zipGroupsBefore).toEqual(report);
      expect(result.zipGroupsAfter.memberBytes + result.zipGroupsAfter.containerOverheadBytes).toBe(result.byteLength);
      expect(result.zipGroupsDifference).toHaveLength(4);
      expect(result.zipGroupsDifference.find((r) => r.group === "media")!.savedPackedBytes).toBeGreaterThan(0);
      expect(result.zipGroupsDifference.every((r) => r.members === report.groups[r.group].members)).toBe(true);
      const originalParts = unzipSync(source);
      const changedParts = unzipSync(new Uint8Array(result.bytes));
      for (const [path, before] of Object.entries(originalParts)) {
        if (/\/media\//u.test(path)) continue;
        expect(identical(changedParts[path]!, before), `${kind}: ${path} must be byte-identical`).toBe(true);
      }
    });
  }
  it("conservative/balanced/compact profiles keep JPEG opt-in and quality mapping bounded", async () => {
    expect(OOXML_COMPRESSION_PROFILE_DEFAULT_JPEG_QUALITY).toEqual({
      conservative: 0.85, balanced: 0.72, compact: 0.55,
    });
    const source = await get("pptx");
    for (const name of ["conservative", "balanced", "compact"] as const) {
      const safe = await compressOoxmlEmbeddedMedia(source, { profile: name }, codec);
      expect(safe.changedCount).toBe(1);
      expect(safe.parts.find((p) => p.type === "jpeg")).toMatchObject({ status: "skipped", skipReason: "lossy-approval-required" });
      expect(safe.parts.find((p) => p.type === "png")).toMatchObject({ status: "changed", fidelity: "decoded-rgba-identical" });
      expect(safe.profile).toBe(name);
    }
    await expect(compressOoxmlEmbeddedMedia(source, { profile: "bogus" as "balanced" }, codec)).rejects.toThrow(/profile/u);
  });
  it("compact + explicit JPEG/resize lowers dimensions and opens while preserving chart/shape XML", async () => {
    const source = await get("pptx");
    const output = await compressOoxmlEmbeddedMedia(source, {
      profile: "compact", approveLossyJpeg: true, approveResize: true, maxDimension: 160,
    }, codec);
    expect(output.outcome).toBe("optimized");
    expect(output.changedCount).toBe(2);
    expect(output.fidelityWarning).toContain("APPROVED LOSSY");
    expect(output.parts.every((p) => p.status === "changed" && p.outputDimensions?.width === 160)).toBe(true);
    const a = unzipSync(source);
    const b = unzipSync(new Uint8Array(output.bytes));
    for (const path of Object.keys(a).filter((p) => p.endsWith(".xml") || p.endsWith(".rels"))) {
      expect(identical(a[path]!, b[path]!), path).toBe(true);
    }
    expect(Object.keys(b).some((p) => p.includes("/charts/"))).toBe(true);
  });
  it("WebP content-typed media is preserved unless approved; never changes extension or XML", async () => {
    const original = unzipSync(await get("docx"));
    const webp = await sharp(await readFile("tests/ooxml-media-fixtures/media-original.png")).webp({ quality: 100 }).toBuffer();
    original["word/media/orphan.webp"] = new Uint8Array(webp);
    const xml = new TextDecoder().decode(original["[Content_Types].xml"]!);
    expect(xml).toContain("</Types>");
    original["[Content_Types].xml"] = new TextEncoder().encode(
      xml.replace("</Types>", '<Default Extension="webp" ContentType="image/webp"/></Types>'),
    );
    const source = zipSync(original);
    const blocked = await compressOoxmlEmbeddedMedia(source, { profile: "compact" }, codec);
    expect(blocked.parts.find((p) => p.type === "webp")).toMatchObject({ status: "skipped", skipReason: "webp-approval-required" });
    const allowed = await compressOoxmlEmbeddedMedia(source, { profile: "compact", approveLossyWebp: true }, codec);
    const webpPart = allowed.parts.find((p) => p.type === "webp");
    expect(webpPart).toMatchObject({ status: "changed", fidelity: "approved-lossy-recode-or-resize" });
    const result = unzipSync(new Uint8Array(allowed.bytes));
    expect(result["word/media/orphan.webp"]?.subarray(0, 4)).toEqual(Uint8Array.from([82, 73, 70, 70]));
    expect(identical(original["[Content_Types].xml"]!, result["[Content_Types].xml"]!)).toBe(true);
  });
  it("fails closed on false group archive byte lengths and true member count changes", async () => {
    const source = await get("xlsx");
    const report = summarizeOoxmlZipGroups(analyzeOoxmlPackage(source), source.length);
    expect(() => summarizeOoxmlZipGroups(analyzeOoxmlPackage(source), 1)).toThrow(/byte length/u);
    const tampered = { ...report, groups: { ...report.groups, xml: { ...report.groups.xml, members: 0 } } };
    expect(() => compareOoxmlZipGroups(report, tampered)).toThrow(/membership/u);
  });
  it("refuses animated PNG and WebP frames instead of flattening them silently", async () => {
    const original = unzipSync(await get("docx"));
    const image = original["word/media/image1.png"]!;
    const animatedChunk = new Uint8Array(12);
    animatedChunk.set([97, 99, 84, 76], 4); // acTL: explicit animation marker
    original["word/media/image1.png"] = Uint8Array.from([...image.subarray(0, 33), ...animatedChunk, ...image.subarray(33)]);
    const webp = new Uint8Array(30);
    webp.set(new TextEncoder().encode("RIFF"), 0);
    webp.set(new TextEncoder().encode("WEBPVP8X"), 8);
    webp[20] = 0x02; // VP8X animated flag
    webp[24] = 2; webp[27] = 2;
    original["word/media/animated.webp"] = webp;
    const xml = new TextDecoder().decode(original["[Content_Types].xml"]!);
    original["[Content_Types].xml"] = new TextEncoder().encode(xml.replace("</Types>", '<Default Extension="webp" ContentType="image/webp"/></Types>'));
    const result = await compressOoxmlEmbeddedMedia(zipSync(original), { approveLossyJpeg: true, approveLossyWebp: true }, codec);
    expect(result.parts.find((p) => p.path.endsWith("image1.png"))).toMatchObject({ status: "skipped", skipReason: "unsupported-media" });
    expect(result.parts.find((p) => p.path.endsWith("animated.webp"))).toMatchObject({ status: "skipped", skipReason: "unsupported-media" });
  });
});
