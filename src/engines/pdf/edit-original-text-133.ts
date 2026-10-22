/**
 * STR-373: conservative semantic edit of an existing PDF text-show operator.
 * Deliberately refuses arbitrary PDF streams, fonts and graphics. This is
 * NOT a white rectangle, a watermark or a new overlay.
 */
import {
  arrayOrNull, dictionaryOrNull, nameValue, numberValue, parsePdf, resolveReference,
  type PdfDictionary, type PdfDocumentModel, type PdfPageNode, type PdfStream,
} from "./parser";
import { buildPdfFromPages } from "./writer";

export interface PdfOriginalTextChange133 {
  readonly page: number;
  readonly before: string;
  readonly after: string;
}

export interface PdfOriginalTextResult133 {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly font: string;
  readonly layout: "COURIER_EQUAL_ADVANCE";
}

const UNSUPPORTED = "UNSUPPORTED_CAPABILITY";
const CANDIDATE = /^\s*BT\s+\/([A-Za-z][A-Za-z0-9]*)\s+(\d+(?:\.\d+)?)\s+Tf\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Td\s+\(([\x20-\x7e]*)\)\s+Tj\s+ET\s*$/u;
const SIMPLE_TEXT = /^[\x20-\x27\x2a-\x5b\x5d-\x7e]{1,128}$/u;
const COURIER = new Set(["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"]);
const SAFE_CATALOG_KEYS = new Set(["Type", "Pages"]);
const SAFE_PAGE_KEYS = new Set(["Type", "Parent", "MediaBox", "CropBox", "Resources", "Contents", "Rotate", "UserUnit"]);

function check(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
}

function refuse(message: string): never {
  throw new Error(UNSUPPORTED + ": " + message);
}

function pageDictionary(node: PdfPageNode): PdfDictionary {
  if (node.object.value.kind !== "dict") return refuse("dizionario pagina ambiguo");
  return node.object.value;
}

function onlyContentStream(model: PdfDocumentModel, node: PdfPageNode): { id: number; stream: PdfStream } {
  const content = pageDictionary(node).entries.get("Contents");
  if (content?.kind !== "ref") return refuse("Contents multipli o diretti: layout ambiguo");
  const stream = resolveReference(model, content);
  if (stream?.kind !== "stream") return refuse("stream di testo assente");
  if (stream.dictionary.entries.has("Filter") || stream.dictionary.entries.has("DecodeParms")) {
    return refuse("stream compresso o codificato non verificabile");
  }
  if ([...stream.dictionary.entries.keys()].some((key) => key !== "Length")) {
    return refuse("stream con proprietà aggiuntive non verificate");
  }
  return { id: content.id, stream };
}

function geometries(model: PdfDocumentModel): string[] {
  return model.pages.map((page) => {
    const dict = pageDictionary(page);
    const info = ["MediaBox", "CropBox"].map((key) => {
      const raw = dict.entries.get(key) ?? page.inherited[key];
      if (raw === undefined && key === "CropBox") return null;
      const result = raw === undefined ? null : arrayOrNull(model, raw)?.items.map(numberValue);
      if (!result || result.length !== 4 || result.some((value) => value === null)
          || result[2]! <= result[0]! || result[3]! <= result[1]!) {
        return refuse("LAYOUT: " + key + " mancante, invalido o degenerato");
      }
      return result;
    });
    const rotationValue = dict.entries.get("Rotate") ?? page.inherited.Rotate;
    const unitValue = dict.entries.get("UserUnit");
    const rotation = rotationValue === undefined ? 0 : numberValue(rotationValue);
    const unit = unitValue === undefined ? 1 : numberValue(unitValue);
    if (rotation === null || unit === null) return refuse("LAYOUT: Rotate o UserUnit non numerico");
    if (rotation !== 0 || unit !== 1) return refuse("pagine ruotate o UserUnit non supportati");
    return JSON.stringify([info, rotation, unit]);
  });
}

function validateSafety(model: PdfDocumentModel): void {
  if (model.encrypted || model.linearized) refuse("PDF cifrati o linearizzati");
  if (!model.root || model.pages.length < 1) refuse("catalogo PDF incompleto");
  const root = dictionaryOrNull(model, model.root);
  if (!root) refuse("catalogo PDF non leggibile");
  if (nameValue(root.entries.get("Type")) !== "Catalog" ||
      [...root.entries.keys()].some((key) => !SAFE_CATALOG_KEYS.has(key))) {
    refuse("LAYOUT: catalogo con navigazione, moduli, firme o struttura non verificata");
  }
  const seenStreams = new Set<number>();
  for (const page of model.pages) {
    const dict = pageDictionary(page);
    if (dict.entries.has("Annots")) refuse("ANNOTATIONS: anche le annotazioni vuote richiedono verifica separata");
    if ([...dict.entries.keys()].some((key) => !SAFE_PAGE_KEYS.has(key))) {
      refuse("LAYOUT: pagina con caratteristiche non verificate");
    }
    const resources = dictionaryOrNull(model, dict.entries.get("Resources") ?? page.inherited.Resources);
    if (!resources || [...resources.entries.keys()].some((key) => key !== "Font")) {
      refuse("LAYOUT: risorse grafiche non verificate");
    }
    const contents = onlyContentStream(model, page);
    if (seenStreams.has(contents.id)) refuse("AMBIGUOUS_TEXT: Contents condivisi tra pagine");
    seenStreams.add(contents.id);
    const match = CANDIDATE.exec(new TextDecoder("latin1").decode(contents.stream.bytes));
    if (!match || !SIMPLE_TEXT.test(match[5] ?? "")) refuse("LAYOUT: ogni pagina deve contenere una sola stringa di testo semplice");
    validatedFont(model, page, match[1]!);
  }
  for (const object of model.objects.values()) {
    const value = object.value.kind === "stream" ? object.value.dictionary : object.value;
    if (value.kind !== "dict") continue;
    if (nameValue(value.entries.get("Type")) === "Sig"
      || nameValue(value.entries.get("FT")) === "Sig"
      || ["ByteRange", "ContentsSig", "Reference", "DocMDP", "FieldMDP"].some((key) => value.entries.has(key))) {
      refuse("SIGNED_PDF: non si alterano firme né revisioni firmate");
    }
    if (["ObjStm", "XRef"].includes(nameValue(value.entries.get("Type")) ?? "")) {
      refuse("object stream e xref stream non supportati");
    }
  }
}

function checkedReplacement(change: PdfOriginalTextChange133): void {
  if (!change || !Number.isInteger(change.page) || change.page < 1) refuse("pagina non valida");
  if (typeof change.before !== "string" || typeof change.after !== "string") refuse("testo non valido");
  if (!SIMPLE_TEXT.test(change.before) || !SIMPLE_TEXT.test(change.after)) refuse("GLYPH: solo ASCII stampabile senza parentesi o backslash");
  if (change.before === change.after) refuse("testo invariato");
  if (change.before.length !== change.after.length) refuse("LAYOUT: lunghezza diversa altera l'avanzamento");
}

function validatedFont(model: PdfDocumentModel, node: PdfPageNode, resourceName: string): string {
  const resource = pageDictionary(node).entries.get("Resources") ?? node.inherited.Resources;
  const resources = dictionaryOrNull(model, resource);
  const fonts = dictionaryOrNull(model, resources?.entries.get("Font"));
  const font = dictionaryOrNull(model, fonts?.entries.get(resourceName));
  const family = nameValue(font?.entries.get("BaseFont"));
  const subtype = nameValue(font?.entries.get("Subtype"));
  const encoding = nameValue(font?.entries.get("Encoding"));
  if (!font || subtype !== "Type1" || !family || !COURIER.has(family)
      || (font.entries.has("Encoding") && encoding !== "WinAnsiEncoding" && encoding !== "StandardEncoding")
      || ["ToUnicode", "FontDescriptor", "Widths", "FirstChar", "LastChar"].some((key) => font.entries.has(key))) {
    return refuse("FONT: richiesto Courier standard Type1 con metriche fisse e mappatura ASCII");
  }
  return family;
}

export function editPdfOriginalText133(
  source: Uint8Array, change: PdfOriginalTextChange133, signal?: AbortSignal,
): PdfOriginalTextResult133 {
  check(signal);
  checkedReplacement(change);
  const original = parsePdf(source);
  validateSafety(original);
  if (change.page > original.pages.length) refuse("pagina fuori intervallo");
  const beforeGeometry = geometries(original);
  const page = original.pages[change.page - 1]!;
  const { id, stream } = onlyContentStream(original, page);
  const content = new TextDecoder("latin1").decode(stream.bytes);
  const match = CANDIDATE.exec(content);
  if (!match || match[5] !== change.before || !SIMPLE_TEXT.test(match[5])) {
    refuse("AMBIGUOUS_TEXT: è ammessa solo una stringa Tj isolata, coincidente esattamente con il testo originale");
  }
  const fontSize = Number(match[2]);
  const x = Number(match[3]), y = Number(match[4]);
  if (fontSize <= 0 || fontSize > 256 || ![x, y].every(Number.isFinite)) refuse("LAYOUT: coordinate o dimensione font non verificabili");
  const font = validatedFont(original, page, match[1]!);
  check(signal);
  const replacement = content.slice(0, match.index) + match[0].replace("(" + change.before + ")", "(" + change.after + ")")
    + content.slice(match.index + match[0].length);
  const objects = new Map(original.objects);
  const oldObject = objects.get(id);
  if (!oldObject || oldObject.value.kind !== "stream") refuse("Contents indiretti mancanti");
  objects.set(id, { ...oldObject, value: { ...oldObject.value, bytes: new TextEncoder().encode(replacement) } });
  const modified = { ...original, objects };
  const bytes = buildPdfFromPages(modified.pages.map((node) => ({ document: modified, page: node })),
    { flatten: false, compress: false, stripMetadata: false });
  check(signal);
  const reopened = parsePdf(bytes);
  validateSafety(reopened);
  if (reopened.pages.length !== original.pages.length || JSON.stringify(geometries(reopened)) !== JSON.stringify(beforeGeometry)) {
    throw new Error("PDF_OUTPUT_MISMATCH: numero pagine o geometria cambiati");
  }
  for (let index = 0; index < original.pages.length; index++) {
    const found = onlyContentStream(reopened, reopened.pages[index]!);
    const expected = index === change.page - 1
      ? replacement
      : new TextDecoder("latin1").decode(onlyContentStream(original, original.pages[index]!).stream.bytes);
    if (new TextDecoder("latin1").decode(found.stream.bytes) !== expected) {
      throw new Error("PDF_OUTPUT_MISMATCH: stream pagina differente dal previsto");
    }
  }
  if (validatedFont(reopened, reopened.pages[change.page - 1]!, match[1]!) !== font) {
    throw new Error("PDF_OUTPUT_MISMATCH: font originale cambiato");
  }
  return { bytes, pageCount: reopened.pages.length, font, layout: "COURIER_EQUAL_ADVANCE" };
}
