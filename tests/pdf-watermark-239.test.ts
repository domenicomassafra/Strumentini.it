import { describe, expect, it } from "vitest";
import { buildPdfFromPages, createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { planPdfWatermark, watermarkPdf, type PdfWatermarkPosition } from "../src/engines/pdf/watermark";
import { nameValue, parsePdf, pdfArray, pdfNumber, resolveReference, type PdfPageNode } from "../src/engines/pdf/parser";

const fixture = () => createSimplePdf(["ALPHA-VECTOR", "BETA-VECTOR", "GAMMA-VECTOR", "DELTA-VECTOR"], { width: 440, height: 600 });

function rotated() {
  const source = fixture();
  const model = parsePdf(source);
  const pages = model.pages.map((page, index): PdfPageNode => {
    if (index !== 1 || page.object.value.kind !== "dict") return page;
    const entries = new Map(page.object.value.entries);
    entries.set("CropBox", pdfArray([pdfNumber(20), pdfNumber(20), pdfNumber(400), pdfNumber(540)]));
    entries.set("Rotate", pdfNumber(90));
    return { object: { ...page.object, value: { kind: "dict", entries } }, inherited: page.inherited };
  });
  return buildPdfFromPages(pages.map((page) => ({ document: model, page })), { flatten: false, compress: false });
}

function contents(bytes: Uint8Array) {
  const doc = parsePdf(bytes);
  return doc.pages.map((page) => {
    const dict = page.object.value;
    if (dict.kind !== "dict") throw new Error("No page dict");
    const resolved = resolveReference(doc, dict.entries.get("Contents"));
    const items = resolved?.kind === "array" ? resolved.items : [dict.entries.get("Contents")];
    return items.map((entry) => {
      const stream = resolveReference(doc, entry);
      if (stream?.kind !== "stream") throw new Error("Invalid stream");
      return stream.bytes;
    });
  });
}

describe("239 PDF watermark: text, opacity, geometry and original streams", () => {
  it("creates verified translucent stream only on a strict page range, keeping all source bytes", async () => {
    const input = fixture(), frozen = input.slice();
    const { artifact, plan } = watermarkPdf(input, { pages: "2-3", text: "DRAFT (COPY) \\ QA", position: "center", opacity: 0.35, rotation: -30, scale: 1.2 });
    expect(input).toEqual(frozen);
    expect(plan.selectedPages).toEqual([2, 3]);
    expect(plan.note).toBe("VISIBLE_OVERLAY_NOT_REDACTION");
    expect(artifact.bytes.subarray(0, 5)).toEqual(new TextEncoder().encode("%PDF-"));
    expect(inspectPdfBytes(artifact.bytes).pageCount).toBe(4);
    const before = contents(input), after = contents(artifact.bytes);
    expect(after.map((p) => p.length)).toEqual([1, 2, 2, 1]);
    for (let page = 0; page < before.length; page++) expect(after[page]![0]).toEqual(before[page]![0]);
    expect(new TextDecoder().decode(after[1]![1])).toContain("(DRAFT \\(COPY\\) \\\\ QA) Tj");
    const pdf = parsePdf(artifact.bytes);
    const gs = [...pdf.objects.values()].find((o) => o.value.kind === "dict" &&
      nameValue(o.value.entries.get("Type")) === "ExtGState");
    expect(gs).toBeDefined();
    const copiedText = await extractPdfText(artifact.bytes);
    expect(copiedText.map((p) => p.text)).toEqual(expect.arrayContaining([expect.stringContaining("ALPHA-VECTOR"), expect.stringContaining("DELTA-VECTOR")]));
  });

  it.each(["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"] as PdfWatermarkPosition[])(
    "previews allowed %s placement consistently", (position) => {
      const result = planPdfWatermark(fixture(), { pages: "1,3", text: "DRAFT", position, opacity: 0.6, rotation: 0, scale: 0.65 });
      expect(result.placements).toHaveLength(2);
      for (const p of result.placements) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.y).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(p.displayWidth);
        expect(p.y).toBeLessThan(p.displayHeight);
        expect(p.opacity).toBe(0.6);
      }
    });

  it("uses actual CropBox origin and rotated visible geometry", () => {
    const input = rotated();
    const { plan, artifact } = watermarkPdf(input, { pages: "2", text: "ROTATED", rotation: 0, opacity: 0.5, scale: 0.7 });
    expect(plan.placements[0]).toMatchObject({ page: 2, displayWidth: 520, displayHeight: 380, pageRotation: 90 });
    expect(plan.placements[0]!.matrix[0]).toBeCloseTo(0);
    expect(plan.placements[0]!.matrix[1]).toBeCloseTo(1);
    expect(inspectPdfBytes(artifact.bytes).pages[1]?.rotation).toBe(90);
    expect(contents(artifact.bytes)[1]![0]).toEqual(contents(input)[1]![0]);
  });

  it.each(["2-1", "1,1", "0", "5", "1,", "1;3", "garbage", ""])("rejects strict range %s", (pages) => {
    expect(() => watermarkPdf(fixture(), { pages, text: "DRAFT" })).toThrow();
  });

  it("rejects blank/binary/non-ASCII text, invalid opacity, rotation, scale, position and margin", () => {
    for (const options of [
      { text: "" }, { text: "a".repeat(49) }, { text: "città" }, { text: "a\nb" },
      { opacity: 0 }, { opacity: 1.01 }, { rotation: 181 }, { rotation: -181 },
      { scale: 0.01 }, { scale: 5 }, { margin: 1 }, { margin: 100 },
      { position: "outside" as PdfWatermarkPosition },
    ]) expect(() => watermarkPdf(fixture(), { pages: "1", text: "DRAFT", ...options })).toThrow();
  });

  it("fails on impossible geometry and respects cancellation", () => {
    expect(() => watermarkPdf(createSimplePdf(["tiny"], { width: 90, height: 90 }), {
      pages: "1", text: "LONG WATERMARK", scale: 3, opacity: 0.5, rotation: 45,
    })).toThrow(/troppo grande/iu);
    const controller = new AbortController(); controller.abort();
    expect(() => watermarkPdf(fixture(), { pages: "*", text: "DRAFT" }, controller.signal)).toThrow();
  });
});
