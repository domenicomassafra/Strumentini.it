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

  it.each([
    ["XFA", "/X#46A"],
    ["signature", "/Sig#46lags"],
    ["JavaScript", "/Open#41ction"],
  ] as const)("rifiuta la variante con nome PDF codificato: %s", async (kind, encodedName) => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 400]);
    doc.getForm().createTextField("nome").addToPage(page, { x: 24, y: 300, width: 140, height: 26 });
    // The pinned pdf-lib writer normalizes names. Construct only this hostile
    // test fixture with an escaped serialization of an otherwise valid PDFName.
    const encodedKey = PDFName.of("test-hex-name-" + kind);
    Object.defineProperty(encodedKey, "encodedName", { value: encodedName });
    if (kind === "XFA") doc.getForm().acroForm.dict.set(encodedKey, PDFString.of("template"));
    else if (kind === "signature") doc.getForm().acroForm.dict.set(encodedKey, doc.context.obj(3));
    else {
      const action = doc.context.obj({});
      const escapedJs = PDFName.of("test-hex-JS");
      Object.defineProperty(escapedJs, "encodedName", { value: "/J#53" });
      const escapedType = PDFName.of("test-hex-JavaScript");
      Object.defineProperty(escapedType, "encodedName", { value: "/Java#53cript" });
      action.set(PDFName.of("S"), escapedType);
      action.set(escapedJs, PDFString.of("app.alert('unsafe')"));
      doc.catalog.set(encodedKey, action);
    }
    const source = await doc.save({ useObjectStreams: false, updateFieldAppearances: false });
    const serialized = new TextDecoder("latin1").decode(source);
    expect(serialized).toContain(encodedName);
    if (kind === "JavaScript") {
      expect(serialized).toContain("/J#53");
      expect(serialized).toContain("/Java#53cript");
      expect(serialized).not.toMatch(/\/(?:OpenAction|JavaScript|JS)\b/);
    }
    const unchanged = source.slice();
    await expect(inspectEditablePdfForm136(source)).rejects.toThrow(/UNSUPPORTED_CAPABILITY/);
    await expect(editPdfForm136(source, { nome: "Mario" }, font)).rejects.toThrow(/UNSUPPORTED_CAPABILITY/);
    expect(source).toEqual(unchanged);
  });

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
