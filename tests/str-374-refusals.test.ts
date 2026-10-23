import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { createPdfAnnotations134 } from "../src/engines/pdf/annotations-134";

async function croppedRotatedFixture(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([400, 500]);
  page.setCropBox(18, 24, 240, 300);
  page.setRotation(degrees(90));
  page.drawText("Keep this original text", { x: 55, y: 100 });
  return document.save({ useObjectStreams: false });
}

describe("STR-374 rotated page and unsafe-input refusals", () => {
  it("retains the PDF-space rectangle through four rotations, three zoom levels and PDF.js reopening", async () => {
    const source = await croppedRotatedFixture();
    const unchangedSource = source.slice();
    const expected = [50, 70, 125, 93];
    const output = await createPdfAnnotations134(source, [
      { page: 1, kind: "highlight", x: 50, y: 70, width: 75, height: 23, comment: "Stable after zoom" },
    ], "rotated.pdf");
    expect(source).toEqual(unchangedSource);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({ data: output.bytes.slice(), stopAtErrors: true });
    try {
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const marks = await page.getAnnotations();
      const mark = marks.find((entry) => entry.subtype === "Highlight");
      expect(mark?.rect).toEqual(expected);
      expect(mark?.contentsObj?.str).toBe("Stable after zoom");
      expect(page.rotate).toBe(90);
      for (const rotation of [0, 90, 180, 270]) {
        for (const scale of [0.5, 1, 2.5]) {
          const viewport = page.getViewport({ scale, rotation });
          const leftTop = viewport.convertToViewportPoint(expected[0]!, expected[1]!);
          const rightBottom = viewport.convertToViewportPoint(expected[2]!, expected[3]!);
          const first = viewport.convertToPdfPoint(leftTop[0], leftTop[1]);
          const second = viewport.convertToPdfPoint(rightBottom[0], rightBottom[1]);
          expect([...first, ...second].map((number) => Number(number.toFixed(3)))).toEqual(expected);
        }
      }
    } finally { await task.destroy(); }
  }, 20_000);

  it("rejects coordinates outside the CropBox without mutating the source", async () => {
    const source = await croppedRotatedFixture();
    const before = source.slice();
    await expect(createPdfAnnotations134(source, [
      { page: 1, kind: "rectangle", x: 240, y: 100, width: 30, height: 22 },
    ], "crop.pdf")).rejects.toThrow(/COORDINATE_BOUNDS/);
    expect(source).toEqual(before);
  });

  it("refuses signed inputs and AcroForm fields before PDF rewriting", async () => {
    const signed = await PDFDocument.create();
    signed.addPage([300, 300]);
    signed.context.register(signed.context.obj({ Type: "Sig", ByteRange: [0, 2, 4, 8] }));
    const form = await PDFDocument.create();
    form.addPage([300, 300]);
    form.getForm().createTextField("keep");
    for (const input of [await signed.save({ useObjectStreams: false }), await form.save()]) {
      const original = input.slice();
      await expect(createPdfAnnotations134(input, [
        { page: 1, kind: "note", x: 40, y: 40, width: 22, height: 22, comment: "Must refuse" },
      ], "unsafe.pdf")).rejects.toThrow(/FORM_UNSUPPORTED/);
      expect(input).toEqual(original);
    }
  });
});
