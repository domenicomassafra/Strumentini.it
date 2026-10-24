import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { editPdfForm136, inspectEditablePdfForm136 } from "../src/engines/pdf/form-edit-136";

const font = new Uint8Array(readFileSync(new URL("../src/engines/pdf/assets/noto-sans-latin-400-regular.ttf", import.meta.url)));

async function fixture() {
  const pdf = await PDFDocument.create();
  const first = pdf.addPage([400, 500]);
  const second = pdf.addPage([400, 500]);
  const form = pdf.getForm();
  const customer = form.createTextField("cliente.nome");
  customer.addToPage(first, { x: 24, y: 420, width: 200, height: 26 });
  customer.addToPage(second, { x: 24, y: 420, width: 200, height: 26 });
  const check = form.createCheckBox("consenso");
  check.addToPage(first, { x: 24, y: 360, width: 20, height: 20 });
  const choice = form.createDropdown("provincia");
  choice.addOptions(["Bari", "Lecce"]);
  choice.addToPage(first, { x: 24, y: 300, width: 120, height: 24 });
  return pdf.save({ useObjectStreams: false });
}

describe("#136 compilazione AcroForm modificabile", () => {
  it("mantiene campi e widget collegati, apparenze Unicode e pagine riapribili", async () => {
    const source = await fixture();
    const original = source.slice();
    const inspection = await inspectEditablePdfForm136(source);
    expect(inspection.fields.map((field) => field.name)).toEqual(["cliente.nome", "consenso", "provincia"]);
    expect(inspection.fields.find((field) => field.name === "cliente.nome")?.widgetCount).toBe(2);
    const output = await editPdfForm136(source, {
      "cliente.nome": "Città di Bari – € 42",
      consenso: true,
      provincia: "Lecce",
    }, font);
    const reopened = await PDFDocument.load(output.bytes);
    const form = reopened.getForm();
    expect(form.getTextField("cliente.nome").getText()).toBe("Città di Bari – € 42");
    expect(form.getCheckBox("consenso").isChecked()).toBe(true);
    expect(form.getDropdown("provincia").getSelected()).toEqual(["Lecce"]);
    expect(form.getTextField("cliente.nome").acroField.getWidgets()).toHaveLength(2);
    expect(reopened.getPageCount()).toBe(2);
    expect(output.flattened).toBe(false);
    expect(source).toEqual(original);
    expect(output.bytes.byteLength).toBeLessThan(50 * 1024 * 1024);
  });

  it("appiattisce solo su scelta esplicita e il risultato non ha campi", async () => {
    const source = await fixture();
    const output = await editPdfForm136(source, { "cliente.nome": "Mario" }, font, { flatten: true });
    const pdf = await PDFDocument.load(output.bytes);
    expect(pdf.getForm().getFields()).toHaveLength(0);
    expect(pdf.getPageCount()).toBe(2);
    expect(output.flattened).toBe(true);
  });

  it("rifiuta valore fuori opzioni, nomi ignoti e documenti attivi XFA senza modificare input", async () => {
    const source = await fixture();
    const original = source.slice();
    await expect(editPdfForm136(source, { provincia: "Roma" }, font)).rejects.toThrow(/INVALID_INPUT|UNSUPPORTED_CAPABILITY/);
    await expect(editPdfForm136(source, { sconosciuto: "x" }, font)).rejects.toThrow(/INVALID_INPUT/);
    const pdf = await PDFDocument.load(source);
    pdf.getForm().acroForm.dict.set(PDFName.of("XFA"), PDFString.of("x"));
    const xfa = await pdf.save({ useObjectStreams: false, updateFieldAppearances: false });
    expect(new TextDecoder("latin1").decode(xfa)).toContain("/XFA");
    await expect(inspectEditablePdfForm136(xfa)).rejects.toThrow(/UNSUPPORTED_CAPABILITY.*XFA/);
    expect(source).toEqual(original);
  });

  it("rifiuta JavaScript, input troncato, richieste grandi e annullamento", async () => {
    const source = await fixture();
    const pdf = await PDFDocument.load(source);
    pdf.catalog.set(PDFName.of("OpenAction"), pdf.context.obj({ S: "JavaScript", JS: "app.alert('x')" }));
    await expect(editPdfForm136(await pdf.save({ useObjectStreams: false }), { "cliente.nome": "x" }, font)).rejects.toThrow(/UNSUPPORTED_CAPABILITY/);
    await expect(inspectEditablePdfForm136(source.slice(0, 80))).rejects.toThrow();
    await expect(inspectEditablePdfForm136(new Uint8Array(26 * 1024 * 1024))).rejects.toThrow(/PDF_LIMIT/);
    const controller = new AbortController();
    controller.abort();
    await expect(editPdfForm136(source, { "cliente.nome": "x" }, font, { signal: controller.signal })).rejects.toThrow(/CANCELLED/);
  });

  it("rifiuta firme e revisioni multiple, preservando i byte di origine", async () => {
    const source = await fixture();
    const original = source.slice();
    const pdf = await PDFDocument.load(source);
    pdf.getForm().acroForm.dict.set(PDFName.of("SigFlags"), pdf.context.obj(3));
    const signed = await pdf.save({ useObjectStreams: false, updateFieldAppearances: false });
    await expect(editPdfForm136(signed, { "cliente.nome": "Mario" }, font)).rejects.toThrow(/UNSUPPORTED_CAPABILITY/);
    const joined = new Uint8Array(source.byteLength * 2);
    joined.set(source);
    joined.set(source, source.byteLength);
    await expect(editPdfForm136(joined, { "cliente.nome": "Mario" }, font)).rejects.toThrow(/UNSUPPORTED_CAPABILITY|MALFORMED_PDF/);
    expect(source).toEqual(original);
  });

  it("PDF.js riapre e disegna il flatten con testo e senza annotazioni", async () => {
    const source = await fixture();
    const output = await editPdfForm136(source, { "cliente.nome": "Mario" }, font, { flatten: true });
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: Uint8Array.from(output.bytes), useSystemFonts: true });
    try {
      const reader = await task.promise;
      expect(reader.numPages).toBe(2);
      for (let i = 1; i <= 2; i++) {
        const page = await reader.getPage(i);
        expect(await page.getAnnotations()).toHaveLength(0);
        const text = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ");
        expect(text).toContain("Mario");
        expect((await page.getOperatorList()).fnArray.length).toBeGreaterThan(5);
        page.cleanup();
      }
    } finally { await task.destroy(); }
  }, 20000);


  it("supporta radio interconnessi e protegge i campi readonly", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([300, 350]);
    const radio = pdf.getForm().createRadioGroup("consegna");
    radio.addOptionToPage("posta", page, { x: 22, y: 220, width: 20, height: 20 });
    radio.addOptionToPage("email", page, { x: 22, y: 180, width: 20, height: 20 });
    const source = await pdf.save({ useObjectStreams: false });
    const result = await editPdfForm136(source, { consegna: "email" }, font);
    const reopened = await PDFDocument.load(result.bytes);
    expect(reopened.getForm().getRadioGroup("consegna").getSelected()).toBe("email");
    expect(reopened.getForm().getRadioGroup("consegna").acroField.getWidgets()).toHaveLength(2);

    const protectedDoc = await PDFDocument.load(await fixture());
    protectedDoc.getForm().getTextField("cliente.nome").enableReadOnly();
    const readonly = await protectedDoc.save({ useObjectStreams: false, updateFieldAppearances: false });
    await expect(editPdfForm136(readonly, { "cliente.nome": "cambio" }, font)).rejects.toThrow(/UNSUPPORTED_CAPABILITY.*protetto/);

    const preserved = await editPdfForm136(readonly, { provincia: "Bari" }, font);
    const independent = await PDFDocument.load(preserved.bytes);
    expect(independent.getForm().getTextField("cliente.nome").isReadOnly()).toBe(true);
    expect(independent.getForm().getTextField("cliente.nome").getText() ?? "").toBe("");
    expect(independent.getForm().getDropdown("provincia").getSelected()).toEqual(["Bari"]);
  });

});
