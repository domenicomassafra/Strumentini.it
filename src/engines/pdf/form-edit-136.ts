import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFRef,
} from "pdf-lib";
import { inspectPdfBytes } from "./index";
import { parsePdf } from "./parser";
import { auditPdfFormAnnotations } from "./form-annotation-audit";
import { PDF_LIMITS } from "./types";

/** Strict, bounded AcroForm subset. Input is never modified; every failure blocks export. */
export type PdfFormValue136 = string | boolean;
export type PdfFormKind136 = "text" | "checkbox" | "dropdown" | "radio";
export interface PdfFormField136 {
  readonly name: string;
  readonly kind: PdfFormKind136;
  readonly value: string | boolean;
  readonly options: readonly string[];
  readonly readOnly: boolean;
  readonly widgetCount: number;
}
export interface PdfEditableForm136 { readonly fields: readonly PdfFormField136[]; readonly pageCount: number; readonly annotationCount: number }
export interface PdfFormEditResult136 {
  readonly bytes: Uint8Array;
  readonly flattened: boolean;
  readonly pageCount: number;
  readonly fieldsChanged: number;
}

const MAX_SOURCE = 8 * 1024 * 1024;
const MAX_PAGES = 80;
const MAX_FIELDS = 120;
const MAX_TEXT = 1000;
const forbiddenNames = /\/(?:XFA|JavaScript|JS|AA|OpenAction|Perms|ByteRange|SigFlags|Sig|ObjStm)\b/u;

function fail(code: "INVALID_INPUT" | "UNSUPPORTED_CAPABILITY" | "PDF_LIMIT" | "MALFORMED_PDF" | "CANCELLED", message: string): never {
  throw new Error(`${code}: ${message}`);
}
function abort(signal?: AbortSignal) {
  if (signal?.aborted) fail("CANCELLED", "Operazione annullata, originale intatto");
}
function validateSource(source: Uint8Array, signal?: AbortSignal) {
  abort(signal);
  if (!(source instanceof Uint8Array) || !source.length) fail("INVALID_INPUT", "Seleziona un PDF locale");
  if (source.byteLength > MAX_SOURCE) fail("PDF_LIMIT", "PDF oltre 8 MiB");
  const text = new TextDecoder("latin1").decode(source);
  if (!text.startsWith("%PDF-") || !/startxref\s+\d+\s+%%EOF\s*$/u.test(text)) {
    fail("MALFORMED_PDF", "Header, xref o chiusura PDF non validi");
  }
  if ((text.match(/%%EOF/g) ?? []).length !== 1) {
    fail("UNSUPPORTED_CAPABILITY", "Revisioni incrementali non supportate");
  }
  if (/\/Encrypt\b/u.test(text)) fail("UNSUPPORTED_CAPABILITY", "PDF cifrato non supportato");
  if (forbiddenNames.test(text)) fail("UNSUPPORTED_CAPABILITY", "XFA, JavaScript, firme o azioni PDF non supportati");
  if (/\/FT\s*\/Sig\b/u.test(text)) fail("UNSUPPORTED_CAPABILITY", "Campi firma non supportati");
  abort(signal);
}

async function open(source: Uint8Array, signal?: AbortSignal) {
  validateSource(source, signal);
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(source.slice(), { throwOnInvalidObject: true, updateMetadata: false });
  } catch { fail("MALFORMED_PDF", "Impossibile interpretare il PDF"); }
  abort(signal);
  if (pdf.isEncrypted) fail("UNSUPPORTED_CAPABILITY", "PDF cifrato");
  const pageCount = pdf.getPageCount();
  if (pageCount < 1 || pageCount > MAX_PAGES) fail("PDF_LIMIT", "Massimo 80 pagine");
  let inspection: ReturnType<typeof inspectPdfBytes>;
  try { inspection = inspectPdfBytes(source); }
  catch { fail("MALFORMED_PDF", "Parser indipendente: PDF non verificabile"); }
  if (inspection.encrypted || inspection.pageCount !== pageCount) fail("MALFORMED_PDF", "Conteggio pagine o protezione incoerenti");
  const annotationCount = inspection.pages.reduce((total, page) => total + page.annotationCount, 0);
  let annotationAudit: ReturnType<typeof auditPdfFormAnnotations>;
  try { annotationAudit = auditPdfFormAnnotations(parsePdf(source)); }
  catch { fail("MALFORMED_PDF", "Grafo annotazioni e campi non verificabile"); }
  if (annotationCount > 500) fail("PDF_LIMIT", "Troppe annotazioni");
  const form = pdf.getForm();
  const fields = form.getFields();
  if (!fields.length) fail("INVALID_INPUT", "Il PDF non contiene campi AcroForm compilabili");
  if (fields.length > MAX_FIELDS) fail("PDF_LIMIT", "Troppi campi AcroForm");
  const described: PdfFormField136[] = fields.map((field) => {
    let kind: PdfFormKind136;
    let value: string | boolean;
    let options: readonly string[] = [];
    if (field instanceof PDFTextField) { kind = "text"; value = field.getText() ?? ""; }
    else if (field instanceof PDFCheckBox) { kind = "checkbox"; value = field.isChecked(); }
    else if (field instanceof PDFDropdown) { kind = "dropdown"; value = field.getSelected()[0] ?? ""; options = field.getOptions(); }
    else if (field instanceof PDFRadioGroup) { kind = "radio"; value = field.getSelected() ?? ""; options = field.getOptions(); }
    else fail("UNSUPPORTED_CAPABILITY", `Tipo di campo non supportato: ${field.getName()}`);
    const widgets = field.acroField.getWidgets();
    if (!widgets.length || widgets.length > 8) fail("UNSUPPORTED_CAPABILITY", `Widget assenti o eccessivi: ${field.getName()}`);
    if (kind !== "text" && kind !== "checkbox" && options.length > 100) fail("PDF_LIMIT", "Troppe opzioni");
    return { name: field.getName(), kind, value, options, readOnly: field.isReadOnly(), widgetCount: widgets.length };
  });
  const names = described.map((field) => field.name);
  if (new Set(names).size !== names.length) fail("UNSUPPORTED_CAPABILITY", "Nomi campo duplicati");
  // Only widgets may be present; no other annotation or signature may disappear on rewrite.
  const widgetCount = described.reduce((sum, field) => sum + field.widgetCount, 0);
  if (annotationCount !== widgetCount || annotationAudit.widgetCount !== widgetCount ||
      annotationAudit.annotations.some((entry) => entry.subtype !== "Widget")) {
    fail("UNSUPPORTED_CAPABILITY", "Annotazioni non-widget o widget scollegati non supportati");
  }
  return { pdf, described, pageCount, annotationCount };
}

export async function inspectEditablePdfForm136(source: Uint8Array, signal?: AbortSignal): Promise<PdfEditableForm136> {
  const { described, pageCount, annotationCount } = await open(source, signal);
  return { fields: described, pageCount, annotationCount };
}

export async function editPdfForm136(
  source: Uint8Array,
  updates: Readonly<Record<string, PdfFormValue136>>,
  fontBytes: Uint8Array,
  options: { readonly flatten?: boolean; readonly signal?: AbortSignal } = {},
): Promise<PdfFormEditResult136> {
  const { signal, flatten = false } = options;
  const { pdf, described, pageCount, annotationCount } = await open(source, signal);
  if (typeof updates !== "object" || updates === null || !Object.keys(updates).length) fail("INVALID_INPUT", "Compila almeno un campo");
  if (!(fontBytes instanceof Uint8Array) || fontBytes.byteLength > 2 * 1024 * 1024 || !fontBytes.byteLength) {
    fail("INVALID_INPUT", "Font Unicode incorporabile richiesto");
  }
  const form = pdf.getForm();
  for (const [name, value] of Object.entries(updates)) {
    abort(signal);
    const spec = described.find((field) => field.name === name);
    if (!spec) fail("INVALID_INPUT", `Campo sconosciuto: ${name}`);
    if (spec.readOnly) fail("UNSUPPORTED_CAPABILITY", `Campo protetto: ${name}`);
    if (spec.kind === "checkbox") {
      if (typeof value !== "boolean") fail("INVALID_INPUT", `Checkbox ${name}: valore booleano richiesto`);
      if (value) form.getCheckBox(name).check(); else form.getCheckBox(name).uncheck();
    } else {
      if (typeof value !== "string" || value.length > MAX_TEXT || /[\u0000-\u0008\u000e-\u001f]/u.test(value)) {
        fail("INVALID_INPUT", `Valore non valido: ${name}`);
      }
      if (spec.kind === "text") form.getTextField(name).setText(value);
      else {
        if (!spec.options.includes(value)) fail("INVALID_INPUT", `Opzione non disponibile per ${name}`);
        if (spec.kind === "dropdown") form.getDropdown(name).select(value);
        else form.getRadioGroup(name).select(value);
      }
    }
  }
  abort(signal);
  pdf.registerFontkit(fontkit);
  const embeddedFont = await pdf.embedFont(fontBytes.slice(), { subset: true });
  abort(signal);
  try {
    form.updateFieldAppearances(embeddedFont);
    if (flatten) {
      form.flatten({ updateFieldAppearances: false });
      // pdf-lib 1.17.1 removeField() uses appearance refs instead of widget refs;
      // some page /Annots arrays retain dangling widgets after flatten.
      // Preflight proved every source annotation is a widget of these fields.
      for (const page of pdf.getPages()) {
        const remaining = [...(page.node.Annots()?.asArray() ?? [])];
        for (const reference of remaining) {
          if (!(reference instanceof PDFRef)) fail("UNSUPPORTED_CAPABILITY", "Annotazione diretta non appiattibile");
          page.node.removeAnnot(reference);
        }
      }
    }
  } catch { fail("UNSUPPORTED_CAPABILITY", "Impossibile rigenerare le apparenze dei campi"); }
  abort(signal);
  let bytes: Uint8Array;
  try { bytes = await pdf.save({ useObjectStreams: false, updateFieldAppearances: false }); }
  catch { fail("UNSUPPORTED_CAPABILITY", "PDF non esportabile senza perdita di apparenze"); }
  abort(signal);
  if (bytes.byteLength > PDF_LIMITS.maxOutputBytes) fail("PDF_LIMIT", "PDF risultante oltre 50 MiB");
  const verified = await PDFDocument.load(bytes, { throwOnInvalidObject: true });
  abort(signal);
  if (verified.getPageCount() !== pageCount) fail("MALFORMED_PDF", "Numero pagine cambiato");
  const fieldsAfter = verified.getForm().getFields();
  if (flatten ? fieldsAfter.length !== 0 : fieldsAfter.length !== described.length) {
    fail("MALFORMED_PDF", "Campi persi durante esportazione");
  }
  if (!flatten) {
    for (const spec of described) {
      const actual = fieldsAfter.find((field) => field.getName() === spec.name);
      if (!actual || actual.acroField.getWidgets().length !== spec.widgetCount) fail("MALFORMED_PDF", `Widget persi: ${spec.name}`);
      if (actual.isReadOnly() !== spec.readOnly) fail("MALFORMED_PDF", `Protezione campo cambiata: ${spec.name}`);
      const valueAfter = actual instanceof PDFTextField ? (actual.getText() ?? "")
        : actual instanceof PDFCheckBox ? actual.isChecked()
        : actual instanceof PDFDropdown ? (actual.getSelected()[0] ?? "")
        : actual instanceof PDFRadioGroup ? (actual.getSelected() ?? "")
        : undefined;
      const expectedValue = Object.prototype.hasOwnProperty.call(updates, spec.name) ? updates[spec.name] : spec.value;
      if (valueAfter === undefined || valueAfter !== expectedValue) {
        fail("MALFORMED_PDF", `Valore campo perso o modificato: ${spec.name}`);
      }
    }
  }
  let reopened: ReturnType<typeof inspectPdfBytes>;
  try { reopened = inspectPdfBytes(bytes); }
  catch { fail("MALFORMED_PDF", "Il PDF esportato non supera la riapertura indipendente"); }
  const annotationAfter = reopened.pages.reduce((sum, page) => sum + page.annotationCount, 0);
  if (annotationAfter !== (flatten ? 0 : annotationCount)) fail("MALFORMED_PDF", `Annotazioni non preservate: ${annotationAfter}/${annotationCount}, flatten=${flatten}`);
  return { bytes, flattened: flatten, pageCount, fieldsChanged: Object.keys(updates).length };
}
