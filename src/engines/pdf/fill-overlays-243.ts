/**
 * #243 strict source-only subset. OUTPUT IS ALWAYS FLATTENED page content,
 * NEVER an editable widget/annotation or a redaction.
 *
 * AcroForm support: simple ASCII /Tx with exactly one page-backed /Widget and
 * a valid /Rect. No XFA, signature, button, choice, javascript, actions,
 * pre-existing non-widget annotations, rotation or appearance preservation.
 */
import {
  arrayOrNull, dictionaryOrNull, nameValue, numberValue, parsePdf, pdfArray, pdfDict, pdfName,
  pdfNumber, pdfReference, resolveReference, valueToText,
  type PdfDocumentModel, type PdfDictionary, type PdfPageNode, type PdfValue,
} from "./parser";
import { auditPdfFormAnnotations } from "./form-annotation-audit";
import { buildPdfFromPages } from "./writer";
import type { PdfArtifact } from "./types";

export type Pdf243Mode = "text" | "highlight" | "text-field";
export interface Pdf243Options {
  readonly mode: Pdf243Mode;
  readonly page: number;
  /** Display-space, PDF points from the top-left corner. */
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  /** For AcroForm /Tx only, exact fully qualified field name. */
  readonly fieldName?: string;
  readonly text?: string;
}
export interface Pdf243Field {
  readonly name: string;
  readonly page: number;
  readonly rect: readonly [number, number, number, number];
}
export interface Pdf243Plan {
  readonly mode: Pdf243Mode;
  readonly page: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly text: string;
  readonly fieldName: string | null;
  readonly outputPolicy: "flattened-visible-page-content-NOT-editable-NOT-redaction";
}
export interface Pdf243Result {
  readonly artifact: PdfArtifact;
  readonly plan: Pdf243Plan;
}

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 24;
function fail(code: string, detail: string): never { throw new Error(`${code}: ${detail}`); }
function ensureRunning(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Elaborazione annullata", "AbortError");
}
function rect(model: PdfDocumentModel, value: PdfValue | undefined) {
  const parts = arrayOrNull(model, value)?.items.map(numberValue);
  if (parts?.length !== 4 || parts.some((n) => n === null)) fail("UNSUPPORTED_CAPABILITY", "Rettangolo PDF assente/non valido");
  const [x0, y0, x1, y1] = parts as [number, number, number, number];
  if (![x0, y0, x1, y1].every((n) => Number.isFinite(n) && n >= 0 && n <= 14400) ||
      x1 <= x0 || y1 <= y0) fail("UNSUPPORTED_CAPABILITY", "Rettangolo PDF irregolare");
  return [x0, y0, x1, y1] as const;
}
function pageInfo(model: PdfDocumentModel, page: number) {
  if (!Number.isInteger(page) || page < 1 || page > model.pages.length) fail("INVALID_INPUT", "Pagina sorgente inesistente");
  const node = model.pages[page - 1]!;
  const dict = node.object.value;
  if (dict.kind !== "dict") fail("UNSUPPORTED_CAPABILITY", "Pagina PDF non valida");
  const media = rect(model, dict.entries.get("MediaBox") ?? node.inherited.MediaBox);
  const crop = rect(model, dict.entries.get("CropBox") ?? node.inherited.CropBox ?? dict.entries.get("MediaBox") ?? node.inherited.MediaBox);
  const rotation = numberValue(resolveReference(model, dict.entries.get("Rotate") ?? node.inherited.Rotate)) ?? 0;
  const unit = numberValue(resolveReference(model, dict.entries.get("UserUnit"))) ?? 1;
  if (rotation !== 0 || unit !== 1 || media[0] !== 0 || media[1] !== 0 ||
    crop.some((n, i) => n !== media[i])) fail("UNSUPPORTED_CAPABILITY", "Solo pagine con origine 0, CropBox normale, rotazione 0, UserUnit=1");
  return { node, width: media[2], height: media[3] };
}
function modelFor(bytes: Uint8Array) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 || bytes.length > MAX_BYTES) {
    fail("PDF_LIMIT", "PDF richiesto entro 8 MiB");
  }
  const model = parsePdf(bytes);
  if (model.encrypted || model.pages.length < 1 || model.pages.length > MAX_PAGES) {
    fail("UNSUPPORTED_CAPABILITY", "PDF cifrato, vuoto o oltre 24 pagine");
  }
  const root = model.root ? dictionaryOrNull(model, model.root) : null;
  if (!root || ["AA", "OpenAction", "Names", "Perms"].some((key) => root.entries.has(key))) {
    fail("UNSUPPORTED_CAPABILITY", "Azioni o script PDF non supportati");
  }
  if (model.text.includes("/ByteRange") || model.text.includes("/DocMDP")) {
    fail("UNSUPPORTED_CAPABILITY", "PDF firmato o con vincoli di certificazione non modificabile");
  }
  if (model.pages.some((page) => page.object.value.kind === "dict" &&
    ["AA", "A", "PresSteps"].some((key) => page.object.value.kind === "dict" && page.object.value.entries.has(key)))) {
    fail("UNSUPPORTED_CAPABILITY", "Azioni di pagina non preservabili o sicure");
  }
  return model;
}
function strictAscii(input: unknown): string {
  if (typeof input !== "string" || input.trim() === "" || input.length > 70 ||
    !/^[\x20-\x7e]+$/u.test(input)) fail("INVALID_TEXT", "Testo ASCII stampabile di 1–70 caratteri; niente script Unicode o multilinea");
  return input;
}
function checkFieldModel(model: PdfDocumentModel): readonly Pdf243Field[] {
  const root = model.root ? dictionaryOrNull(model, model.root) : null;
  const acro = dictionaryOrNull(model, root?.entries.get("AcroForm"));
  const fields = arrayOrNull(model, acro?.entries.get("Fields"));
  if (!acro || !fields || fields.items.length < 1 || fields.items.length > 12 ||
      ["XFA", "AA", "CO", "DR"].some((key) => acro.entries.has(key))) {
    fail("UNSUPPORTED_FORM", "Solo AcroForm semplici con massimo 12 campi testo senza XFA/scripts");
  }
  const needAppearances = resolveReference(model, acro.entries.get("NeedAppearances"));
  if ((numberValue(acro.entries.get("SigFlags")) ?? 0) !== 0 ||
    (needAppearances?.kind === "literal" && needAppearances.value === "true")) {
    fail("UNSUPPORTED_FORM", "Firme o appearance dinamico non supportati");
  }
  const audit = auditPdfFormAnnotations(model);
  if (audit.annotations.length !== fields.items.length ||
    audit.annotations.some((annotation) => annotation.subtype !== "Widget" ||
      annotation.hidden || annotation.page < 1 || annotation.page > model.pages.length)) {
    fail("UNSUPPORTED_FORM", "Widget e annotazioni aggiuntive non supportate");
  }
  const output: Pdf243Field[] = [];
  for (const ref of fields.items) {
    if (ref.kind !== "ref") fail("UNSUPPORTED_FORM", "Campi AcroForm non indiretti");
    const field = dictionaryOrNull(model, ref);
    if (!field || nameValue(field.entries.get("FT")) !== "Tx" || nameValue(field.entries.get("Subtype")) !== "Widget" ||
      field.entries.has("Kids") || field.entries.has("AA") || field.entries.has("A") ||
      field.entries.has("AP") || field.entries.has("AS") || field.entries.has("Lock") ||
      field.entries.has("SV") || field.entries.has("Opt")) {
      fail("UNSUPPORTED_FORM", "Solo widget /Tx terminali senza appearance/action esistenti");
    }
    const flags = numberValue(field.entries.get("Ff")) ?? 0;
    if (flags !== 0) fail("UNSUPPORTED_FORM", "Campi read-only, multilinea, password o speciali non supportati");
    const name = valueToText(resolveReference(model, field.entries.get("T")));
    if (!name || !/^[A-Za-z][\w.-]{0,39}$/u.test(name) || output.some((previous) => previous.name === name)) {
      fail("UNSUPPORTED_FORM", "Nomi univoci ASCII dei campi richiesti");
    }
    const pages = audit.annotations.filter((annotation) => annotation.objectId === ref.id);
    if (pages.length !== 1) fail("UNSUPPORTED_FORM", "Ogni campo deve comparire una sola volta come widget nella pagina");
    const place = pageInfo(model, pages[0]!.page);
    const bounds = rect(model, field.entries.get("Rect"));
    if (bounds[2] > place.width || bounds[3] > place.height ||
      bounds[2] - bounds[0] < 40 || bounds[3] - bounds[1] < 16) fail("UNSUPPORTED_FORM", "Widget fuori pagina o troppo piccolo");
    output.push({ name, page: pages[0]!.page, rect: bounds });
  }
  return output;
}

export function listPdf243Fields(bytes: Uint8Array): readonly Pdf243Field[] {
  return checkFieldModel(modelFor(bytes));
}
export function planPdf243(bytes: Uint8Array, options: Pdf243Options): Pdf243Plan {
  const model = modelFor(bytes);
  const mode = options?.mode;
  if (mode !== "text" && mode !== "highlight" && mode !== "text-field") fail("INVALID_INPUT", "Modalità non valida");
  let x = options.x ?? NaN, y = options.y ?? NaN, width = options.width ?? NaN, height = options.height ?? NaN;
  let fieldName: string | null = null;
  const page = options.page;
  const info = pageInfo(model, page);
  if (mode === "text-field") {
    const field = checkFieldModel(model).find((candidate) => candidate.name === options.fieldName && candidate.page === page);
    if (!field) fail("UNSUPPORTED_FORM", "Seleziona un campo AcroForm /Tx verificato per quella pagina");
    fieldName = field.name;
    [x, y, width, height] = [field.rect[0], info.height - field.rect[3],
      field.rect[2] - field.rect[0], field.rect[3] - field.rect[1]];
  } else {
    // Overlay on PDFs with no pre-existing widgets/actions/annotations only.
    const audit = auditPdfFormAnnotations(model);
    const root = model.root ? dictionaryOrNull(model, model.root) : null;
    if (audit.annotationCount !== 0 || root?.entries.has("AcroForm")) {
      fail("UNSUPPORTED_CAPABILITY", "PDF con campi/annotazioni: usare solo modulo /Tx verificato");
    }
  }
  const text = mode === "highlight" ? "" : strictAscii(options.text);
  if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width < 30 || height < 12 ||
    x + width > info.width || y + height > info.height) fail("INVALID_REGION", "Rettangolo fuori pagina o troppo piccolo");
  if (mode !== "highlight" && (text.length * 7.1 > width - 6 || height < 16)) {
    fail("INVALID_TEXT", "Testo troppo lungo per il rettangolo: nessun clipping nascosto");
  }
  return { mode, page, pageWidth: info.width, pageHeight: info.height, x, y, width, height, text, fieldName,
    outputPolicy: "flattened-visible-page-content-NOT-editable-NOT-redaction" };
}
function contentRefs(model: PdfDocumentModel, node: PdfPageNode): readonly PdfValue[] {
  const dict = node.object.value;
  if (dict.kind !== "dict") fail("UNSUPPORTED_CAPABILITY", "Pagina senza dizionario");
  const source = dict.entries.get("Contents");
  if (!source) return [];
  const resolved = resolveReference(model, source);
  if (source.kind === "ref" && resolved?.kind === "stream") return [source];
  if (resolved?.kind === "array" && resolved.items.every((item) => item.kind === "ref" && resolveReference(model, item)?.kind === "stream")) return resolved.items;
  fail("UNSUPPORTED_CAPABILITY", "Stream contenuti non indiretti o non supportati");
}
function draw(plan: Pdf243Plan) {
  const bottom = plan.pageHeight - plan.y - plan.height;
  const x = Number(plan.x.toFixed(3)), y = Number(bottom.toFixed(3));
  const w = Number(plan.width.toFixed(3)), h = Number(plan.height.toFixed(3));
  if (plan.mode === "highlight") {
    return `q /P243GS gs 1 0.85 0 rg ${x} ${y} ${w} ${h} re f Q\n`;
  }
  const baseline = y + (h - 12) / 2 + 3;
  const escaped = plan.text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  return `q BT /P243F 12 Tf 0 0 0 rg 1 0 0 1 ${x + 3} ${Number(baseline.toFixed(3))} Tm (${escaped}) Tj ET Q\n`;
}
export function writePdf243(bytes: Uint8Array, options: Pdf243Options, signal?: AbortSignal): Pdf243Result {
  ensureRunning(signal);
  const plan = planPdf243(bytes, options);
  const source = modelFor(bytes);
  const objects = new Map(source.objects);
  let nextId = Math.max(...objects.keys()) + 1;
  const fontId = nextId++;
  const gsId = nextId++;
  objects.set(fontId, { id: fontId, generation: 0,
    value: pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica"), Encoding: pdfName("WinAnsiEncoding") }) });
  objects.set(gsId, { id: gsId, generation: 0,
    value: pdfDict({ Type: pdfName("ExtGState"), ca: pdfNumber(0.35), CA: pdfNumber(0.35) }) });
  const pages = source.pages.map((node, index): PdfPageNode => {
    if (index + 1 !== plan.page) return node;
    ensureRunning(signal);
    const dict = node.object.value;
    if (dict.kind !== "dict") fail("UNSUPPORTED_CAPABILITY", "Pagina senza dizionario");
    const resources = dictionaryOrNull(source, dict.entries.get("Resources") ?? node.inherited.Resources) ?? pdfDict({});
    const fonts = dictionaryOrNull(source, resources.entries.get("Font")) ?? pdfDict({});
    const states = dictionaryOrNull(source, resources.entries.get("ExtGState")) ?? pdfDict({});
    if (fonts.entries.has("P243F") || states.entries.has("P243GS")) fail("UNSUPPORTED_CAPABILITY", "Risorsa P243 già presente");
    const newResources: PdfDictionary = { kind: "dict", entries: new Map([...resources.entries,
      ["Font", { kind: "dict", entries: new Map([...fonts.entries, ["P243F", pdfReference(fontId)]]) }],
      ["ExtGState", { kind: "dict", entries: new Map([...states.entries, ["P243GS", pdfReference(gsId)]]) }],
    ]) };
    const overlayId = nextId++;
    objects.set(overlayId, { id: overlayId, generation: 0,
      value: { kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(draw(plan)) } });
    const updated: PdfDictionary = { kind: "dict", entries: new Map([...dict.entries,
      ["Resources", newResources], ["Contents", pdfArray([...contentRefs(source, node), pdfReference(overlayId)])],
    ]) };
    return { ...node, object: { ...node.object, value: updated } };
  });
  const changed: PdfDocumentModel = { ...source, objects, pages };
  const output = buildPdfFromPages(pages.map((page) => ({ document: changed, page })),
    { flatten: true, stripMetadata: true, compress: false });
  ensureRunning(signal);
  const reopened = parsePdf(output);
  if (reopened.pages.length !== source.pages.length || auditPdfFormAnnotations(reopened).annotationCount !== 0 ||
    auditPdfFormAnnotations(reopened).fieldCount !== 0 ||
    (reopened.root && dictionaryOrNull(reopened, reopened.root)?.entries.has("AcroForm"))) {
    fail("PDF_OUTPUT_MISMATCH", "Il PDF esportato contiene ancora widget/annotazioni o pagine cambiate");
  }
  for (const [index, original] of source.pages.entries()) {
    const before = contentRefs(source, original);
    const after = contentRefs(reopened, reopened.pages[index]!);
    if (after.length !== before.length + (index + 1 === plan.page ? 1 : 0)) {
      fail("PDF_OUTPUT_MISMATCH", "Numero stream originali alterato");
    }
    for (let offset = 0; offset < before.length; offset++) {
      const a = resolveReference(source, before[offset]);
      const b = resolveReference(reopened, after[offset]);
      if (a?.kind !== "stream" || b?.kind !== "stream" ||
        a.bytes.length !== b.bytes.length || a.bytes.some((v, i) => v !== b.bytes[i])) {
        fail("PDF_OUTPUT_MISMATCH", "Contenuto sorgente modificato");
      }
    }
  }
  const verified = Uint8Array.from(output);
  return { artifact: { bytes: verified, blob: new Blob([verified], { type: "application/pdf" }),
    mime: "application/pdf", filename: "pdf-overlay-flattened.pdf", pageCount: reopened.pages.length }, plan };
}
