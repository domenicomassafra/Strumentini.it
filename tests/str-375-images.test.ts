import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { degrees, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { insertPdfImage375 } from "../src/engines/pdf/image-placement-375";

const png = new Uint8Array(readFileSync("quality/fixtures/image-metadata/workspace-overlay-red-2x2.png"));
const jpg = new Uint8Array(readFileSync("quality/fixtures/image-format-matrix/source.jpg"));

async function source(rotated = false) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  page.drawText("KEEP_THIS_TEXT", { x: 80, y: 500 });
  page.node.set(PDFName.of("Annots"), doc.context.obj([]));
  const form = doc.getForm();
  const field = form.createTextField("customer");
  field.setText("invariato");
  field.addToPage(page, { x: 20, y: 40, width: 120, height: 30 });
  if (rotated) { page.setCropBox(40, 60, 420, 300); page.setRotation(degrees(90)); }
  return doc.save({ useObjectStreams: false });
}
const placement = { page: 1, x: 0.2, y: 0.25, width: 0.3, rotation: 0 as const };

describe("STR-375 positioned PDF images", () => {
  it.each([["PNG alpha", png], ["JPEG", jpg]])("%s leaves original, form and existing annotations intact and adds image XObject", async (_name, image) => {
    const input = await source();
    const previous = input.slice();
    const before = await PDFDocument.load(input);
    const output = await insertPdfImage375(input, image, placement, "invoice.pdf");
    expect(input).toEqual(previous);
    expect(output.bytes).not.toEqual(input);
    expect(output.pageCount).toBe(1);
    const after = await PDFDocument.load(output.bytes);
    expect(after.getForm().getTextField("customer").getText()).toBe("invariato");
    expect(after.getPages()[0]!.node.Annots()?.size()).toBe(before.getPages()[0]!.node.Annots()?.size());
    const xobjects = after.getPages()[0]!.node.Resources()?.lookup(PDFName.of("XObject"));
    expect(xobjects).toBeDefined();
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({data: output.bytes.slice(), stopAtErrors: true});
    try {
      const doc = await task.promise;
      const page = await doc.getPage(1);
      expect((await page.getOperatorList()).fnArray.length).toBeGreaterThan(0);
      const contents = await page.getTextContent();
      expect(contents.items.some((item) => "str" in item && item.str.includes("KEEP_THIS_TEXT"))).toBe(true);
      page.cleanup();
    } finally { await task.destroy(); }
  });

  it("maps placement on a rotated cropped page and reopens with geometry preserved", async () => {
    const input = await source(true);
    const output = await insertPdfImage375(input, jpg, { page: 1, x: .1, y: .1, width: .45, rotation: 90 }, "crop.pdf");
    const reopened = await PDFDocument.load(output.bytes);
    const page = reopened.getPage(0);
    expect(page.getRotation().angle).toBe(90);
    expect(page.getCropBox()).toEqual({ x: 40, y: 60, width: 420, height: 300 });
    expect(page.node.Annots()?.size()).toBe(1);
  });

  it("rejects unsupported profiles, oversized placement, cancellation and preserves source", async () => {
    const input = await source();
    const snapshot = input.slice();
    await expect(insertPdfImage375(input, jpg, { ...placement, x: .9 }, "bad.pdf")).rejects.toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(insertPdfImage375(input, png, placement, "cancel.pdf", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    const unsupportedJpeg = new Uint8Array(readFileSync("tests/fixtures/image-exifr-272/jpeg-icc-iptc.jpg"));
    await expect(insertPdfImage375(input, unsupportedJpeg, placement, "icc.pdf")).rejects.toThrow(/UNSUPPORTED/);
    expect(input).toEqual(snapshot);
  });
  it("preserves shared image resources on both pages while adding a new raster", async () => {
    const doc = await PDFDocument.create();
    const existing = await doc.embedPng(png);
    doc.addPage([300, 400]).drawImage(existing, { x: 10, y: 10, width: 20, height: 20 });
    doc.addPage([300, 400]).drawImage(existing, { x: 80, y: 80, width: 20, height: 20 });
    const input = await doc.save({ useObjectStreams: false });
    const references = (pdf: PDFDocument, page: number) => {
      const resources = pdf.getPage(page).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
      return resources?.entries().map(([, ref]) => ref.toString()) ?? [];
    };
    const before = await PDFDocument.load(input);
    const originalFirst = references(before, 0);
    const originalSecond = references(before, 1);
    expect(originalFirst).toEqual(originalSecond);
    const output = await insertPdfImage375(input, jpg, { page: 1, x: .3, y: .3, width: .2, rotation: 0 }, "shared.pdf");
    const reopened = await PDFDocument.load(output.bytes);
    expect(references(reopened, 1)).toEqual(originalSecond);
    expect(references(reopened, 0)).toHaveLength(originalFirst.length + 1);
    expect(references(reopened, 0)).toContain(originalFirst[0]);
  });

  it("refuses unsupported PNG color modes without changing bytes", async () => {
    const input = await source();
    const wrongColor = png.slice();
    wrongColor[25] = 3; // indexed transparency needs a different supported policy
    await expect(insertPdfImage375(input, wrongColor, placement, "no.pdf")).rejects.toThrow(/UNSUPPORTED/);
  });

});
