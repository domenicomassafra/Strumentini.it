import { describe, expect, it } from "vitest";
import { PDFDocument, PDFHexString } from "pdf-lib";
import { runPdfPageWorkspace372 } from "../src/engines/pdf/workspace-372";
import { verifyPdfSourceBoundExport380 } from "../src/engines/pdf/source-bound-export-380";

async function originalWithComment(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const first = pdf.addPage([320, 420]);
  first.drawText("SOURCE_ALPHA", { x: 24, y: 120 });
  const second = pdf.addPage([360, 440]);
  second.drawText("SOURCE_BETA", { x: 26, y: 180 });
  const appearance = pdf.context.register(pdf.context.flateStream(
    "q 1 0.82 0 rg 0 0 95 18 re f Q",
    { Type: "XObject", Subtype: "Form", BBox: [0, 0, 95, 18] },
  ));
  const annotation = pdf.context.register(pdf.context.obj({
    Type: "Annot", Subtype: "Highlight", Rect: [24, 176, 119, 194],
    F: 4, AP: { N: appearance }, Contents: PDFHexString.fromText("Commento semantico"),
    QuadPoints: [24, 194, 119, 194, 24, 176, 119, 176],
  }));
  second.node.addAnnot(annotation);
  return pdf.save({ useObjectStreams: false });
}

async function readWithPdfJs(data: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({ data: data.slice(), stopAtErrors: true, useSystemFonts: false });
  try {
    const pdf = await loading.promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const text = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join("");
      const annotations = (await page.getAnnotations()).map((item) => ({
        subtype: item.subtype, comment: item.contentsObj?.str, rect: item.rect,
      }));
      pages.push({ text, annotations, width: page.view[2]! - page.view[0]! });
      page.cleanup();
    }
    return pages;
  } finally {
    await loading.destroy();
  }
}

describe("STR-380 source-bound page export", () => {
  it("preserves text, order, size and a real highlight/comment through an independent PDF.js re-open", async () => {
    const source = await originalWithComment();
    const originalBytes = source.slice();
    const artifact = await runPdfPageWorkspace372(source, [2, 1], [], "reorder", "scoped.pdf");
    expect(source).toEqual(originalBytes);
    expect(artifact.mime).toBe("application/pdf");
    expect(artifact.bytes.slice(0, 5)).toEqual(new TextEncoder().encode("%PDF-"));
    expect(artifact.bytes).not.toEqual(source);
    const pages = await readWithPdfJs(artifact.bytes);
    expect(pages.map((page) => page.text)).toEqual(["SOURCE_BETA", "SOURCE_ALPHA"]);
    expect(pages.map((page) => page.width)).toEqual([360, 320]);
    expect(pages[0]?.annotations).toEqual([{
      subtype: "Highlight", comment: "Commento semantico", rect: [24, 176, 119, 194],
    }]);
    expect(pages[1]?.annotations).toEqual([]);
  });

  it("exports a selected annotated page and verifies the source-page binding", async () => {
    const source = await originalWithComment();
    const artifact = await runPdfPageWorkspace372(source, [2, 1], [2], "selected", "scoped.pdf");
    expect((await readWithPdfJs(artifact.bytes)).map((page) => page.text)).toEqual(["SOURCE_BETA"]);
    await expect(verifyPdfSourceBoundExport380(source, artifact.bytes, {
      kind: "page-transfer", sourcePages: [1],
    })).rejects.toThrow(/PDF_VERIFY/);
  });
});
