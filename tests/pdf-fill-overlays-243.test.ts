import { describe, expect, it } from "vitest";
import { PdfBuilder, createSimplePdf } from "../src/engines/pdf/writer";
import { pdfArray, pdfDict, pdfName, pdfNumber, pdfString, parsePdf } from "../src/engines/pdf/parser";
import { extractPdfText } from "../src/engines/pdf";
import { listPdf243Fields, planPdf243, writePdf243 } from "../src/engines/pdf/fill-overlays-243";

/** Real, independently parseable PDF with page-backed, terminal /Tx widget. */
export function pdf243FormFixture(type: "Tx" | "Btn" | "Sig" = "Tx", extraAnnotation = false,
  sigFlags = 0, pageAction = false): Uint8Array {
  const b = new PdfBuilder();
  const pages = b.reserve();
  const font = b.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const stream = b.putAuto({ kind: "stream", dictionary: pdfDict({}),
    bytes: new TextEncoder().encode("BT /F1 14 Tf 40 350 Td (RICHIESTA) Tj ET\n") });
  const page = b.reserve();
  const widget = b.putAuto(pdfDict({
    Type: pdfName("Annot"), Subtype: pdfName("Widget"), FT: pdfName(type), T: pdfString("Ragione"),
    Rect: pdfArray([pdfNumber(55), pdfNumber(228), pdfNumber(260), pdfNumber(260)]), P: page,
  }));
  const other = b.putAuto(pdfDict({ Type: pdfName("Annot"), Subtype: pdfName("Text"),
    Rect: pdfArray([pdfNumber(100), pdfNumber(150), pdfNumber(130), pdfNumber(190)]) }));
  b.put(page, pdfDict({
    Type: pdfName("Page"), Parent: pages, MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(360), pdfNumber(400)]),
    Resources: pdfDict({ Font: pdfDict({ F1: font }) }), Contents: stream,
    Annots: pdfArray(extraAnnotation ? [widget, other] : [widget]),
    ...(pageAction ? { AA: pdfDict({ O: pdfDict({ S: pdfName("JavaScript") }) }) } : {}),
  }));
  b.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const acro = b.putAuto(pdfDict({ Fields: pdfArray([widget]), SigFlags: pdfNumber(sigFlags) }));
  const catalog = b.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages, AcroForm: acro }));
  return b.build(catalog, null);
}

describe("#243 bounded fill and overlay, flattened only", () => {
  it("detects only supported real AcroForm /Tx and flattens it visibly", async () => {
    const input = pdf243FormFixture();
    expect(listPdf243Fields(input)).toEqual([{ name: "Ragione", page: 1, rect: [55, 228, 260, 260] }]);
    const plan = planPdf243(input, { mode: "text-field", page: 1, fieldName: "Ragione", text: "ABC 001" });
    expect(plan).toMatchObject({ x: 55, y: 140, width: 205, height: 32, text: "ABC 001",
      outputPolicy: "flattened-visible-page-content-NOT-editable-NOT-redaction" });
    const result = writePdf243(input, { mode: "text-field", page: 1, fieldName: "Ragione", text: "ABC 001" });
    const page = (await extractPdfText(result.artifact.bytes))[0]!.text;
    expect(page).toContain("RICHIESTA");
    expect(page).toContain("ABC 001");
    const model = parsePdf(result.artifact.bytes);
    expect(model.pages[0]!.object.value.kind).toBe("dict");
    if (model.pages[0]!.object.value.kind === "dict") expect(model.pages[0]!.object.value.entries.has("Annots")).toBe(false);
    const root = model.root && model.objects.get(model.root.id)?.value;
    if (root?.kind === "dict") expect(root.entries.has("AcroForm")).toBe(false);
    expect(result.artifact.bytes.subarray(0, 5)).toEqual(new TextEncoder().encode("%PDF-"));
  });

  it("refuses signature, button, extra annotations, wrong field and source action", () => {
    for (const kind of ["Sig", "Btn"] as const) {
      expect(() => listPdf243Fields(pdf243FormFixture(kind))).toThrow(/UNSUPPORTED_FORM/);
    }
    expect(() => listPdf243Fields(pdf243FormFixture("Tx", true))).toThrow(/UNSUPPORTED_FORM/);
    expect(() => listPdf243Fields(pdf243FormFixture("Tx", false, 1))).toThrow(/UNSUPPORTED_FORM/);
    expect(() => listPdf243Fields(pdf243FormFixture("Tx", false, 0, true))).toThrow(/UNSUPPORTED_CAPABILITY/);
    expect(() => writePdf243(pdf243FormFixture(), { mode: "text-field", page: 1, fieldName: "Other", text: "A" }))
      .toThrow(/UNSUPPORTED_FORM/);
    expect(() => writePdf243(pdf243FormFixture(), { mode: "text", page: 1, x: 50, y: 50, width: 80, height: 20, text: "A" }))
      .toThrow(/UNSUPPORTED_CAPABILITY/);
  });

  it("writes page text and highlight as actual flattened content, rejects clipping/injection", async () => {
    const input = createSimplePdf(["BEFORE"], { width: 360, height: 400 });
    const text = writePdf243(input, { mode: "text", page: 1, x: 60, y: 130, width: 160, height: 30, text: "AFTER 003" });
    expect((await extractPdfText(text.artifact.bytes))[0]!.text).toContain("AFTER 003");
    expect((await extractPdfText(text.artifact.bytes))[0]!.text).toContain("BEFORE");
    const highlight = writePdf243(input, { mode: "highlight", page: 1, x: 45, y: 118, width: 200, height: 25 });
    expect((await extractPdfText(highlight.artifact.bytes))[0]!.text).toContain("BEFORE");
    expect(highlight.plan.mode).toBe("highlight");
    expect(() => planPdf243(input, { mode: "text", page: 1, x: 40, y: 80, width: 40, height: 22, text: "LONG LONG" }))
      .toThrow(/INVALID_TEXT/);
    expect(() => planPdf243(input, { mode: "text", page: 1, x: 40, y: 80, width: 200, height: 22, text: "(\n malicious)" }))
      .toThrow(/INVALID_TEXT/);
    expect(() => planPdf243(input, { mode: "highlight", page: 1, x: 340, y: 80, width: 100, height: 22 }))
      .toThrow(/INVALID_REGION/);
  });
});
