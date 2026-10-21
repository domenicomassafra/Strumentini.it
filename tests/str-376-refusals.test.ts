import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { editPdfForm136, inspectEditablePdfForm136 } from "../src/engines/pdf/form-edit-136";

const font = new Uint8Array(readFileSync(new URL("../src/engines/pdf/assets/noto-sans-latin-400-regular.ttf", import.meta.url)));

async function unsafeForm(kind: "XFA" | "signature" | "JavaScript") {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 400]);
  doc.getForm().createTextField("nome").addToPage(page, { x: 24, y: 300, width: 140, height: 26 });
  if (kind === "XFA") {
    doc.getForm().acroForm.dict.set(PDFName.of("XFA"), PDFString.of("template"));
  } else if (kind === "signature") {
    doc.getForm().acroForm.dict.set(PDFName.of("SigFlags"), doc.context.obj(3));
  } else {
    doc.catalog.set(PDFName.of("OpenAction"), doc.context.obj({ S: "JavaScript", JS: "app.alert('unsafe')" }));
  }
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false });
}

describe("STR-376: i moduli non supportati restano intatti", () => {
  it.each(["XFA", "signature", "JavaScript"] as const)(
    "rifiuta %s sia nell'ispezione sia nell'export senza modificare i byte",
    async (kind) => {
      const source = await unsafeForm(kind);
      const snapshot = source.slice();
      await expect(inspectEditablePdfForm136(source)).rejects.toThrow(/UNSUPPORTED_CAPABILITY/);
      await expect(editPdfForm136(source, { nome: "Mario" }, font, { flatten: true }))
        .rejects.toThrow(/UNSUPPORTED_CAPABILITY/);
      expect(source).toEqual(snapshot);
    },
  );

  it("rifiuta una seconda revisione e non restituisce un PDF parziale", async () => {
    const source = await unsafeForm("XFA");
    const concatenated = new Uint8Array(source.byteLength * 2);
    concatenated.set(source);
    concatenated.set(source, source.byteLength);
    const copy = concatenated.slice();
    await expect(editPdfForm136(concatenated, { nome: "Mario" }, font))
      .rejects.toThrow(/UNSUPPORTED_CAPABILITY|MALFORMED_PDF/);
    expect(concatenated).toEqual(copy);
  });
});
