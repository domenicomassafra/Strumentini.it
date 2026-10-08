import { describe, expect, it } from "vitest";
import { buildPdfFromPages, createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { cropNormalizePdf, planPdfCropNormalize, type PdfCropNormalizeOptions } from "../src/engines/pdf/crop-normalize";
import { parsePdf, pdfArray, pdfNumber, resolveReference, type PdfPageNode } from "../src/engines/pdf/parser";

const basic = () => createSimplePdf(["PAGE-ALPHA", "PAGE-BETA", "PAGE-GAMMA", "PAGE-DELTA"], { width: 320, height: 440 });
function mixed(): Uint8Array {
  const input = basic();
  const model = parsePdf(input);
  const pages = model.pages.map((node, index): PdfPageNode => {
    if (node.object.value.kind !== "dict") throw new Error("Invalid fixture");
    const entries = new Map(node.object.value.entries);
    const size = index === 0 ? [320, 440] : index === 1 ? [440, 320] : index === 2 ? [380, 520] : [320, 440];
    entries.set("MediaBox", pdfArray([pdfNumber(0), pdfNumber(0), ...size.map(pdfNumber)]));
    if (index === 1) {
      entries.set("CropBox", pdfArray([pdfNumber(30), pdfNumber(20), pdfNumber(410), pdfNumber(300)]));
      entries.set("Rotate", pdfNumber(90));
    } else if (index === 2) {
      entries.set("CropBox", pdfArray([pdfNumber(10), pdfNumber(30), pdfNumber(370), pdfNumber(490)]));
      entries.set("Rotate", pdfNumber(270));
    } else if (index === 3) entries.set("Rotate", pdfNumber(180));
    return { object: { ...node.object, value: { kind: "dict", entries } }, inherited: node.inherited };
  });
  return buildPdfFromPages(pages.map((page) => ({ document: model, page })), { flatten: false, compress: false });
}
function originalStreams(bytes: Uint8Array): Uint8Array[][] {
  const model = parsePdf(bytes);
  return model.pages.map((node) => {
    const page = node.object.value;
    if (page.kind !== "dict") throw new Error("Invalid page");
    const current = page.entries.get("Contents");
    const resolved = resolveReference(model, current);
    const refs = resolved?.kind === "array" ? resolved.items : [current];
    return refs.map((value) => {
      const stream = resolveReference(model, value);
      if (stream?.kind !== "stream") throw new Error("Invalid stream");
      return stream.bytes;
    });
  });
}

describe("#240 PDF visible CropBox and deterministic page-size normalization", () => {
  it("crops only visibility, keeps MediaBox unchanged, preserves all page content bytes", async () => {
    const source = mixed(), immutable = source.slice();
    const options: PdfCropNormalizeOptions = { mode: "crop", pages: "2-3", insetLeft: 15, insetTop: 20, insetRight: 25, insetBottom: 35 };
    const { plan, artifact } = cropNormalizePdf(source, options);
    expect(plan.selectedPages).toEqual([2, 3]);
    expect(plan.warning).toBe("CROP_HIDES_NOT_REDACTS");
    expect(plan.pages[1]?.originalCrop).toEqual([30, 20, 410, 300]);
    expect(plan.pages[1]?.sourceRotation).toBe(90);
    expect(plan.pages[1]?.resultCrop).toEqual([65, 35, 390, 275]);
    expect(plan.pages[2]?.resultCrop).toEqual([30, 55, 335, 475]);
    expect(plan.pages[1]?.resultMedia).toEqual([0, 0, 440, 320]);
    expect(plan.pages[0]?.resultCrop).toEqual(plan.pages[0]?.originalCrop);
    expect(source).toEqual(immutable);
    expect(artifact.bytes.slice(0, 5)).toEqual(new TextEncoder().encode("%PDF-"));
    expect(inspectPdfBytes(artifact.bytes).pages.map((p) => p.rotation)).toEqual([0, 90, 270, 180]);
    expect(originalStreams(artifact.bytes)).toEqual(originalStreams(source));
    const resultText = await extractPdfText(artifact.bytes);
    expect(resultText[0]?.text).toContain("PAGE-ALPHA");
    expect(resultText[1]?.text).toContain("PAGE-BETA");
  });

  it("normalizes selected mixed-size and rotated source pages to A4 portrait, fitting without crop", async () => {
    const source = mixed();
    const plan = planPdfCropNormalize(source, { mode: "normalize", pages: "2-3", preset: "a4-portrait", fit: "contain", margin: 20 });
    expect(plan.warning).toBe("NORMALIZE_REFRAMES_ORIGINAL_CONTENT");
    expect(plan.pages[1]?.sourceVisibleWidth).toBe(280);
    expect(plan.pages[1]?.sourceVisibleHeight).toBe(380);
    for (const p of [1, 2]) {
      expect(plan.pages[p]?.resultMedia).toEqual([0, 0, 595.28, 841.89]);
      expect(plan.pages[p]?.resultCrop).toEqual([0, 0, 595.28, 841.89]);
      expect(plan.pages[p]?.resultRotation).toBe(0);
      expect(plan.pages[p]?.scale).toBeGreaterThan(0);
      expect(plan.pages[p]?.displayedOffsetX).toBeGreaterThanOrEqual(20 - 0.0001);
      expect(plan.pages[p]?.displayedOffsetY).toBeGreaterThanOrEqual(20 - 0.0001);
    }
    const { artifact } = cropNormalizePdf(source, { mode: "normalize", pages: "2-3", preset: "a4-portrait", fit: "contain", margin: 20 });
    expect(inspectPdfBytes(artifact.bytes).pages.map((p) => p.rotation)).toEqual([0, 0, 0, 180]);
    const original = originalStreams(source), rebuilt = originalStreams(artifact.bytes);
    expect(rebuilt.map((s) => s.length)).toEqual([1, 3, 3, 1]);
    for (let p = 0; p < original.length; p++) {
      expect(rebuilt[p]![p === 1 || p === 2 ? 1 : 0]).toEqual(original[p]![0]);
    }
    expect(new TextDecoder().decode(rebuilt[1]![0])).toMatch(/^q\n.* cm\n.* re W n\n$/);
    expect(new TextDecoder().decode(rebuilt[1]![2])).toBe("\nQ\n");
    const text = await extractPdfText(artifact.bytes);
    expect(text[1]?.text).toContain("PAGE-BETA");
    expect(text[2]?.text).toContain("PAGE-GAMMA");
  });

  it("normalizes custom size with no-scale centering only when all source content fits", () => {
    const source = mixed();
    const { artifact, plan } = cropNormalizePdf(source, { mode: "normalize", pages: "1", preset: "custom",
      customWidth: 500, customHeight: 600, fit: "center", margin: 25 });
    expect(plan.pages[0]?.scale).toBe(1);
    expect(plan.pages[0]?.displayedOffsetX).toBe(90);
    expect(plan.pages[0]?.displayedOffsetY).toBe(80);
    expect(inspectPdfBytes(artifact.bytes).pageCount).toBe(4);
    expect(originalStreams(artifact.bytes)[0]).toHaveLength(3);
    expect(() => cropNormalizePdf(source, { mode: "normalize", pages: "1", preset: "custom",
      customWidth: 300, customHeight: 300, fit: "center" })).toThrow(/senza scala/u);
  });

  it.each(["3-2", "1,1", "5", "1-2,2", "", "1;"])("fails closed for invalid range %s", (pages) => {
    expect(() => cropNormalizePdf(basic(), { mode: "crop", pages, insetLeft: 15 })).toThrow();
  });

  it("rejects zero/negative/excess crop, unbounded custom dimensions, invalid mode/fit and abort", () => {
    for (const options of [
      { mode: "crop", pages: "*" }, { mode: "crop", pages: "*", insetLeft: -5 },
      { mode: "crop", pages: "*", insetLeft: 320 }, { mode: "crop", pages: "*", insetTop: 220, insetBottom: 220 },
      { mode: "normalize", pages: "1", preset: "custom", customWidth: 99, customHeight: 200 },
      { mode: "normalize", pages: "1", preset: "custom", customWidth: 200, customHeight: 2001 },
      { mode: "normalize", pages: "1", preset: "bad" }, { mode: "normalize", pages: "1", fit: "stretch" },
    ]) expect(() => cropNormalizePdf(basic(), options as PdfCropNormalizeOptions)).toThrow();
    const abort = new AbortController(); abort.abort();
    expect(() => cropNormalizePdf(basic(), { mode: "crop", pages: "1", insetLeft: 5 }, abort.signal)).toThrow();
  });
});
