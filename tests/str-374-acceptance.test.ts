import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { createPdfAnnotations134 } from "../src/engines/pdf/annotations-134";

async function fixture(form = false): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]).drawText("first page");
  const second = doc.addPage([300, 400]);
  second.setRotation(degrees(90));
  second.drawText("second page");
  if (form) doc.getForm().createTextField("preserve-me");
  return doc.save();
}

describe("STR-374 durable PDF annotations", () => {
  it("exports actual highlight, rectangle and comment objects, retains originals and reopens with PDF.js", async () => {
    const original = await fixture();
    const copy = original.slice();
    const result = await createPdfAnnotations134(original, [
      { page: 2, kind: "highlight", x: 30, y: 100, width: 120, height: 20, comment: "Highlighted passage" },
      { page: 1, kind: "rectangle", x: 22, y: 80, width: 150, height: 70, comment: "Review box" },
      { page: 2, kind: "note", x: 170, y: 210, width: 22, height: 22, comment: "Important note" },
    ], "original.pdf");
    expect(original).toEqual(copy);
    expect(result.filename).toBe("original.annotato.pdf");
    expect(result.pageCount).toBe(2);
    const reopened = await PDFDocument.load(result.bytes);
    expect(reopened.getPageCount()).toBe(2);
    expect(reopened.getPage(1).getRotation().angle).toBe(90);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = pdfjs.getDocument({ data: result.bytes.slice(), stopAtErrors: true });
    try {
      const pdf = await loading.promise;
      const [first, second] = await Promise.all([pdf.getPage(1), pdf.getPage(2)]);
      const ann1 = await first.getAnnotations();
      const ann2 = await second.getAnnotations();
      expect((await first.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ")).toContain("first page");
      expect((await second.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ")).toContain("second page");
      expect(ann1.some((a) => a.subtype === "Square" && a.contentsObj?.str === "Review box")).toBe(true);
      expect(ann2.some((a) => a.subtype === "Highlight" && a.contentsObj?.str === "Highlighted passage")).toBe(true);
      expect(ann2.some((a) => a.subtype === "Text" && a.contentsObj?.str === "Important note")).toBe(true);
      expect(ann2.find((a) => a.subtype === "Highlight")?.rect).toEqual([30, 100, 150, 120]);
    } finally {
      await loading.destroy();
    }
  }, 20_000);

  it("keeps previously saved annotations when reopening and adding another comment", async () => {
    const source = await fixture();
    const first = await createPdfAnnotations134(source, [
      { page: 1, kind: "highlight", x: 20, y: 40, width: 90, height: 15, comment: "First annotation" },
    ], "fixture.pdf");
    const second = await createPdfAnnotations134(first.bytes, [
      { page: 2, kind: "note", x: 35, y: 65, width: 22, height: 22, comment: "Second annotation" },
    ], "fixture.pdf");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = pdfjs.getDocument({ data: second.bytes.slice(), stopAtErrors: true });
    try {
      const pdf = await loading.promise;
      const a = await (await pdf.getPage(1)).getAnnotations();
      const b = await (await pdf.getPage(2)).getAnnotations();
      expect(a.some((mark) => mark.contentsObj?.str === "First annotation")).toBe(true);
      expect(b.some((mark) => mark.contentsObj?.str === "Second annotation")).toBe(true);
    } finally { await loading.destroy(); }
  });

  it("explicitly refuses digital-signature dictionaries before modification", async () => {
    const document = await PDFDocument.create();
    document.addPage([300, 400]);
    document.context.register(document.context.obj({ Type: "Sig", ByteRange: [0, 3, 7, 9] }));
    const source = await document.save({ useObjectStreams: false });
    await expect(createPdfAnnotations134(source, [
      { page: 1, kind: "rectangle", x: 10, y: 20, width: 80, height: 40 },
    ], "signed.pdf")).rejects.toThrow(/firme|FORM_UNSUPPORTED/i);
  });

  it("keeps coordinates fixed when the user changes zoom or page rotation", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({ data: await fixture() });
    try {
      const page = await (await task.promise).getPage(2);
      const pdfRect = [40, 110, 155, 138];
      for (const scale of [0.5, 1, 2.5]) {
        for (const rotation of [0, 90, 180, 270]) {
          const viewport = page.getViewport({ scale, rotation });
          const p1 = viewport.convertToViewportPoint(pdfRect[0]!, pdfRect[1]!);
          const p2 = viewport.convertToViewportPoint(pdfRect[2]!, pdfRect[3]!);
          const a = viewport.convertToPdfPoint(p1[0], p1[1]);
          const b = viewport.convertToPdfPoint(p2[0], p2[1]);
          expect([a[0], a[1], b[0], b[1]].map((n) => Number(n.toFixed(4)))).toEqual(pdfRect);
        }
      }
    } finally { await task.destroy(); }
  });

  it("refuses AcroForms, invalid geometry, empty comments, and cancelled jobs before returning an artifact", async () => {
    await expect(createPdfAnnotations134(await fixture(true), [
      { page: 1, kind: "highlight", x: 10, y: 10, width: 40, height: 20 },
    ], "form.pdf")).rejects.toThrow(/FORM|firma|modul/i);
    const source = await fixture();
    await expect(createPdfAnnotations134(source, [
      { page: 1, kind: "note", x: 15, y: 20, width: 20, height: 20, comment: "  " },
    ], "source.pdf")).rejects.toThrow(/comment|nota/i);
    await expect(createPdfAnnotations134(source, [
      { page: 2, kind: "highlight", x: 280, y: 10, width: 40, height: 20 },
    ], "source.pdf")).rejects.toThrow(/bounds|coordinate|pagina/i);
    const controller = new AbortController();
    controller.abort();
    await expect(createPdfAnnotations134(source, [
      { page: 1, kind: "rectangle", x: 20, y: 20, width: 100, height: 40 },
    ], "source.pdf", controller.signal)).rejects.toThrow();
  });
});
