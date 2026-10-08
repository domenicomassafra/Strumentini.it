import { describe, expect, it } from "vitest";
import { buildPdfFromPages, createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { numberPdfPages, planPdfPageNumbers, type PdfNumberPosition } from "../src/engines/pdf/page-numbers";
import { parsePdf, pdfArray, pdfNumber, resolveReference, type PdfPageNode } from "../src/engines/pdf/parser";

function fixture(): Uint8Array {
  return createSimplePdf(["CONTENT-ALPHA", "CONTENT-BETA", "CONTENT-GAMMA", "CONTENT-DELTA"], { width: 320, height: 440 });
}

function geometries(): Uint8Array {
  const raw = fixture();
  const model = parsePdf(raw);
  const transformed = model.pages.map((page, index): PdfPageNode => {
    if (index > 1 || page.object.value.kind !== "dict") return page;
    const entries = new Map(page.object.value.entries);
    entries.set("CropBox", pdfArray([pdfNumber(20), pdfNumber(20), pdfNumber(300), pdfNumber(380)]));
    if (index === 1) entries.set("Rotate", pdfNumber(90));
    return { object: { ...page.object, value: { kind: "dict", entries } }, inherited: page.inherited };
  });
  return buildPdfFromPages(transformed.map((page) => ({ document: model, page })), { flatten: false, compress: false });
}

function streams(bytes: Uint8Array): Uint8Array[][] {
  const pdf = parsePdf(bytes);
  return pdf.pages.map((page) => {
    const dictionary = page.object.value;
    if (dictionary.kind !== "dict") return [];
    const resolved = resolveReference(pdf, dictionary.entries.get("Contents"));
    if (resolved?.kind === "stream") return [resolved.bytes];
    if (resolved?.kind !== "array") return [];
    return resolved.items.map((value) => {
      const stream = resolveReference(pdf, value);
      if (stream?.kind !== "stream") throw new Error("Invalid content stream");
      return stream.bytes;
    });
  });
}

describe("238 — PDF page numbers: real geometry/overlay contract", () => {
  it("adds overlays only to strict selected pages and preserves every original stream", async () => {
    const input = fixture();
    const copy = input.slice();
    const { artifact, plan } = numberPdfPages(input, {
      pages: "2-3", startNumber: 5, offset: 10, position: "bottom-right", font: "Courier", fontSize: 13, margin: 18,
    });
    expect(plan.selectedPages).toEqual([2, 3]);
    expect(plan.placements.map((p) => p.label)).toEqual(["15", "16"]);
    expect(artifact.bytes.subarray(0, 5)).toEqual(new TextEncoder().encode("%PDF-"));
    expect(artifact.filename).toBe("pdf-numerato.pdf");
    expect(inspectPdfBytes(artifact.bytes).pageCount).toBe(4);
    expect(input).toEqual(copy);
    const before = streams(input);
    const after = streams(artifact.bytes);
    expect(after.map((array) => array.length)).toEqual([1, 2, 2, 1]);
    for (let page = 0; page < 4; page += 1) expect(after[page]![0]).toEqual(before[page]![0]);
    expect(new TextDecoder().decode(after[1]![1])).toContain("(15) Tj");
    expect(new TextDecoder().decode(after[2]![1])).toContain("(16) Tj");
    const text = await extractPdfText(artifact.bytes);
    expect(text[0]?.text).toContain("CONTENT-ALPHA");
    expect(text[1]?.text).toContain("CONTENT-BETA");
    expect(text[2]?.text).toContain("CONTENT-GAMMA");
    expect(text[3]?.text).toContain("CONTENT-DELTA");
  });

  it("positions numbers on CropBox coordinates and keeps upright on rotated pages", () => {
    const input = geometries();
    const { plan, artifact } = numberPdfPages(input, {
      pages: "1-2", startNumber: 1, position: "top-center", fontSize: 14, margin: 25, font: "Helvetica",
    });
    expect(plan.placements[0]).toMatchObject({ displayWidth: 280, displayHeight: 360, rotation: 0, y: 321 });
    expect(plan.placements[1]).toMatchObject({ displayWidth: 360, displayHeight: 280, rotation: 90, y: 241 });
    expect(plan.placements[1]!.matrix.slice(0, 4)).toEqual([0, 1, -1, 0]);
    expect(plan.placements[1]!.matrix[5]).toBeCloseTo(20 + plan.placements[1]!.x);
    expect(inspectPdfBytes(artifact.bytes).pages.map(({ rotation }) => rotation)).toEqual([0, 90, 0, 0]);
    expect(streams(artifact.bytes).map((page) => page.length)).toEqual([2, 2, 1, 1]);
  });

  it.each(["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"] as PdfNumberPosition[])(
    "calculates bounded %s placement and all three selectable standard fonts", (position) => {
      for (const font of ["Helvetica", "Courier", "Times-Roman"] as const) {
        const result = planPdfPageNumbers(fixture(), { pages: "1, 4", position, font, fontSize: 18, margin: 12 });
        expect(result.placements).toHaveLength(2);
        expect(result.placements[0]!.font).toBe(font);
        for (const item of result.placements) {
          expect(item.x).toBeGreaterThanOrEqual(12 - 0.01);
          expect(item.y).toBeGreaterThanOrEqual(12 - 0.01);
          expect(item.x).toBeLessThan(item.displayWidth);
          expect(item.y).toBeLessThan(item.displayHeight);
        }
      }
    });

  it.each(["2-1", "1,1", "0", "5", "1-2,2", "1,", "1;2", "hello", ""])(
    "rejects invalid or duplicate page ranges: %s", (pages) => {
      expect(() => numberPdfPages(fixture(), { pages })).toThrow();
    });

  it("rejects invalid sizing, offsets, unsupported positions, and impossible page geometry", () => {
    const input = fixture();
    const base = { pages: "*" };
    for (const options of [
      { ...base, startNumber: 0 }, { ...base, startNumber: 1.2 }, { ...base, offset: -3 },
      { ...base, offset: 1000 }, { ...base, fontSize: 0 }, { ...base, fontSize: 40 },
      { ...base, margin: 0 }, { ...base, margin: 99 }, { ...base, position: "middle" as PdfNumberPosition },
      { ...base, font: "Symbol" as "Courier" },
    ]) expect(() => numberPdfPages(input, options)).toThrow();
    const tiny = createSimplePdf(["small"], { width: 40, height: 40 });
    expect(() => numberPdfPages(tiny, { pages: "1", fontSize: 30, margin: 20 })).toThrow(/geometria/u);
    const controller = new AbortController();
    controller.abort();
    expect(() => numberPdfPages(input, base, controller.signal)).toThrow(/annullata/u);
  });
});
