import { describe, expect, it } from "vitest";
import {
  planBooklet251, planInterleave251, createInterleave251,
  type Booklet251Options,
} from "../src/engines/pdf/booklet-interleave-251";
import { buildPdfFromPages, createSimplePdf } from "../src/engines/pdf/writer";
import { parsePdf, pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { extractPdfText, inspectPdfBytes } from "../src/engines/pdf";

const booklet: Booklet251Options = { flip: "short-edge", paper: "a4", margin: 18, gap: 10 };
const input = (labels: string[]) => new File([Uint8Array.from(createSimplePdf(labels, { width: 320, height: 480 }))],
  "numbered.pdf", { type: "application/pdf" });
const annotated = () => {
  const model = parsePdf(createSimplePdf(["ANNOTATED"], { width: 320, height: 480 }));
  const page = model.pages[0]!;
  if (page.object.value.kind !== "dict") throw new Error("Expected page dictionary");
  const value = { ...page.object.value, entries: new Map(page.object.value.entries) };
  value.entries.set("Annots", pdfArray([pdfDict({
    Type: pdfName("Annot"), Subtype: pdfName("Link"),
    Rect: pdfArray([pdfNumber(10), pdfNumber(10), pdfNumber(110), pdfNumber(40)]),
    Border: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(0)]),
  })]));
  const bytes = buildPdfFromPages([{ document: model, page: { ...page, object: { ...page.object, value } } }],
    { flatten: false, stripMetadata: true });
  return new File([Uint8Array.from(bytes)], "annotated.pdf", { type: "application/pdf" });
};

describe("#251 deterministic booklet + front/back planning", () => {
  it("folds 4-page signatures with outside-in face order and padded whites", () => {
    expect(planBooklet251(4, booklet).faces.map((side) => [side.left, side.right]))
      .toEqual([[4, 1], [2, 3]]);
    const five = planBooklet251(5, booklet);
    expect(five).toMatchObject({ inputPages: 5, paddedPages: 8, blankPages: 3, sheetCount: 2 });
    expect(five.faces.map((side) => [side.left, side.right])).toEqual([
      [null, 1], [2, null], [null, 3], [4, 5],
    ]);
    expect(five.faces.map((side) => side.side)).toEqual(["front", "back", "front", "back"]);
    for (const number of [1, 2, 3, 4, 5, 7, 8, 9, 16, 31, 32]) {
      const plan = planBooklet251(number, booklet);
      const pages = plan.faces.flatMap((side) => [side.left, side.right]).filter((value): value is number => value !== null);
      expect(pages.toSorted((a, b) => a - b)).toEqual(Array.from({ length: number }, (_, index) => index + 1));
      expect(plan.paddedPages % 4).toBe(0);
      expect(plan.blankPages).toBe(plan.paddedPages - number);
      expect(plan.faces.length).toBe(plan.paddedPages / 2);
    }
  });

  it("documents flip assumptions and rotates backs only for long-edge duplex", () => {
    const short = planBooklet251(7, booklet);
    const long = planBooklet251(7, { ...booklet, flip: "long-edge" });
    expect(short.faces.map((side) => [side.left, side.right])).toEqual(long.faces.map((side) => [side.left, side.right]));
    expect(short.faces.every((side) => side.rotation === 0)).toBe(true);
    expect(long.faces.map((side) => side.rotation)).toEqual([0, 180, 0, 180]);
    expect(long.duplexNote).toContain("180°");
    expect(short.duplexNote).toContain("lato corto");
    expect(() => planBooklet251(33, booklet)).toThrow(/32/);
    expect(() => planBooklet251(1, { ...booklet, margin: -1 })).toThrow(/Margine/);
  });

  it("interleaves two sides without dropping/repeating pages, reverse/forward switch", () => {
    expect(planInterleave251(3, 3, { backOrder: "reverse", mismatchPolicy: "reject" }).pages
      .map((page) => [page.source, page.sourcePage])).toEqual([
        ["front", 1], ["back", 3], ["front", 2], ["back", 2], ["front", 3], ["back", 1],
      ]);
    expect(planInterleave251(2, 2, { backOrder: "forward", mismatchPolicy: "reject" }).pages
      .map((page) => page.sourcePage)).toEqual([1, 1, 2, 2]);
    expect(() => planInterleave251(3, 2, { backOrder: "reverse", mismatchPolicy: "reject" })).toThrow(/LENGTH_MISMATCH/);
    const padded = planInterleave251(3, 2, { backOrder: "reverse", mismatchPolicy: "pad-shorter" });
    expect(padded.blankPages).toBe(1);
    expect(padded.pages.map((page) => page.sourcePage)).toEqual([1, 2, 2, 1, 3, null]);
    expect(planInterleave251(2, 3, { backOrder: "reverse", mismatchPolicy: "pad-shorter" }).pages
      .map((page) => page.sourcePage)).toEqual([1, 3, 2, 2, null, 1]);
    expect(() => planInterleave251(32, 33, { backOrder: "forward", mismatchPolicy: "pad-shorter" })).toThrow(/32/);
  });

  it("creates actual vector PDF with explicit blank page, verified order and geometry", async () => {
    const generated = await createInterleave251(input(["F1", "F2", "F3"]), input(["B1", "B2"]),
      { backOrder: "reverse", mismatchPolicy: "pad-shorter" });
    const inspected = inspectPdfBytes(generated.artifact.bytes);
    expect(inspected.pageCount).toBe(6);
    expect(generated.plan.blankPages).toBe(1);
    expect(inspected.pages.every((page) => page.width === 320 && page.height === 480)).toBe(true);
    const texts = await extractPdfText(generated.artifact.bytes);
    expect(texts.map((text) => text.text.trim())).toEqual(["F1", "B2", "F2", "B1", "F3", ""]);
    expect(generated.artifact.bytes.slice(0, 5)).toEqual(new TextEncoder().encode("%PDF-"));
    await expect(createInterleave251(input(["F1", "F2"]), input(["B1"]),
      { backOrder: "reverse", mismatchPolicy: "reject" })).rejects.toThrow(/LENGTH_MISMATCH/);
  });

  it("rejects annotated source PDFs rather than silently flattening away page actions", async () => {
    await expect(createInterleave251(annotated(), input(["B1"]),
      { backOrder: "forward", mismatchPolicy: "reject" })).rejects.toThrow(/UNSUPPORTED_CAPABILITY/);
    await expect(createInterleave251(input(["F1"]), annotated(),
      { backOrder: "reverse", mismatchPolicy: "reject" })).rejects.toThrow(/UNSUPPORTED_CAPABILITY/);
  });
});
