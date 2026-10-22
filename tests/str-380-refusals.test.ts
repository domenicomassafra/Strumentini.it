import { describe, expect, it } from "vitest";
import { PDFDocument, PDFHexString } from "pdf-lib";
import { runPdfPageWorkspace372 } from "../src/engines/pdf/workspace-372";
import { verifyPdfSourceBoundExport380 } from "../src/engines/pdf/source-bound-export-380";

async function source(text = "KEEP_TEXT"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]).drawText(text);
  return doc.save({ useObjectStreams: false });
}

describe("STR-380 refusals prevent false fidelity", () => {
  it("rejects a PDF with the same geometry but altered original text", async () => {
    const first = await source();
    const forged = await source("LOST_TEXT");
    await expect(verifyPdfSourceBoundExport380(first, forged, {
      kind: "page-transfer", sourcePages: [1],
    })).rejects.toThrow(/PDF_VERIFY/);
    expect(first).not.toEqual(forged);
  });

  it("refuses unsupported edit models even when a PDF is syntactically valid", async () => {
    const original = await source();
    await expect(verifyPdfSourceBoundExport380(original, original, {
      kind: "arbitrary-text-reflow", sourcePages: [1],
    })).rejects.toThrow(/PDF_UNSUPPORTED_MODEL/);
    await expect(verifyPdfSourceBoundExport380(original, original, {
      kind: "page-transfer", sourcePages: [2],
    })).rejects.toThrow(/PDF_UNSUPPORTED_MODEL/);
  });

  it("refuses forms, signature objects and unsupported interactive annotations before exporting", async () => {
    const form = await PDFDocument.create();
    form.addPage([300, 400]);
    form.getForm().createTextField("invoice");
    const signed = await PDFDocument.create();
    signed.addPage([300, 400]);
    signed.context.register(signed.context.obj({ Type: "Sig", ByteRange: [0, 10, 20, 30] }));
    const linked = await PDFDocument.create();
    const page = linked.addPage([300, 400]);
    const annotation = linked.context.register(linked.context.obj({
      Type: "Annot", Subtype: "Link", Rect: [10, 10, 80, 25],
      Contents: PDFHexString.fromText("Unsupported link"),
    }));
    page.node.addAnnot(annotation);
    for (const original of [
      await form.save({ useObjectStreams: false }),
      await signed.save({ useObjectStreams: false }),
      await linked.save({ useObjectStreams: false }),
    ]) {
      const immutable = original.slice();
      await expect(runPdfPageWorkspace372(original, [1], [], "reorder", "unsupported.pdf"))
        .rejects.toThrow(/PDF_UNSUPPORTED_MODEL/);
      expect(original).toEqual(immutable);
    }
  });

  it("rejects an annotation silently dropped from a superficially valid PDF", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 400]);
    page.drawText("KEEP_TEXT");
    const stream = doc.context.register(doc.context.flateStream("q Q", {
      Type: "XObject", Subtype: "Form", BBox: [0, 0, 10, 10],
    }));
    page.node.addAnnot(doc.context.register(doc.context.obj({
      Type: "Annot", Subtype: "Text", Rect: [10, 10, 20, 20],
      F: 4, AP: { N: stream }, Contents: PDFHexString.fromText("Original comment"),
    })));
    const original = await doc.save({ useObjectStreams: false });
    const copyWithoutComment = await source();
    await expect(verifyPdfSourceBoundExport380(original, copyWithoutComment, {
      kind: "page-transfer", sourcePages: [1],
    })).rejects.toThrow(/PDF_VERIFY/);
  });
});
