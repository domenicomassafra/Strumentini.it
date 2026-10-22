import { PDFDocument } from "pdf-lib";
import { extractPdfText, inspectPdfBytes } from "./index";
import {
  arrayOrNull, dictionaryOrNull, nameValue, numberValue, parsePdf,
  resolveReference, streamOrNull, valueToText, type PdfDocumentModel,
} from "./parser";
import { PDF_LIMITS } from "./types";

/**
 * A bounded page export contract. Other editor models must supply their own
 * semantic oracle before they are permitted to use this gate.
 */
export interface PdfSourceBoundPlan380 {
  readonly kind: string;
  readonly sourcePages: readonly number[];
}

const ALLOWED_ANNOTATIONS = new Set(["Highlight", "Square", "Text"]);

function refusal(message: string): never {
  throw new Error("PDF_UNSUPPORTED_MODEL: " + message + "; originale conservato");
}

function abort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Esportazione annullata", "AbortError");
}

function values(model: PdfDocumentModel, page: number) {
  const node = model.pages[page - 1];
  if (!node || node.object.value.kind !== "dict") refusal("Pagina non verificabile");
  const annotations = arrayOrNull(model, node.object.value.entries.get("Annots"));
  if (node.object.value.entries.has("Annots") && !annotations) refusal("Annotazioni pagina non leggibili");
  return (annotations?.items ?? []).map((reference) => {
    const annotation = dictionaryOrNull(model, reference);
    const subtype = nameValue(annotation?.entries.get("Subtype"));
    if (!annotation || !subtype || !ALLOWED_ANNOTATIONS.has(subtype)) {
      refusal("Annotazione interattiva o non supportata");
    }
    if (annotation.entries.has("A") || annotation.entries.has("AA") || annotation.entries.has("RichMediaContent")) {
      refusal("Azioni PDF attive non supportate");
    }
    const appearance = dictionaryOrNull(model, annotation.entries.get("AP"));
    const stream = streamOrNull(model, appearance?.entries.get("N"));
    if (!stream) refusal("Appearance stream annotazione non verificabile");
    const nums = (key: string) => {
      const list = arrayOrNull(model, annotation.entries.get(key));
      if (!list) return null;
      const items = list.items.map((item) => numberValue(resolveReference(model, item)));
      if (items.some((item) => item === null)) refusal("Coordinate annotazione non verificabili");
      return items;
    };
    const rect = nums("Rect");
    if (!rect || rect.length !== 4) refusal("Rettangolo annotazione non verificabile");
    return {
      subtype, flags: numberValue(annotation.entries.get("F")),
      rect, contents: valueToText(resolveReference(model, annotation.entries.get("Contents"))),
      title: valueToText(resolveReference(model, annotation.entries.get("T"))),
      color: nums("C"), quadPoints: nums("QuadPoints"),
      appearanceBytes: stream.bytes,
    };
  });
}

function inspectModel(model: PdfDocumentModel): void {
  if (model.encrypted || model.root === null) refusal("Documento cifrato o catalogo assente");
  const root = dictionaryOrNull(model, model.root);
  if (!root || root.entries.has("AcroForm") || root.entries.has("Perms") ||
      root.entries.has("OpenAction") || root.entries.has("AA")) {
    refusal("Moduli, firme, permessi o azioni documentali non verificabili");
  }
  for (const object of model.objects.values()) {
    const value = object.value.kind === "stream" ? object.value.dictionary : object.value;
    if (value.kind === "dict" && (value.entries.has("ByteRange") ||
        nameValue(value.entries.get("Type")) === "Sig" ||
        nameValue(value.entries.get("Subtype")) === "Widget")) {
      refusal("Firme o widget PDF non supportati");
    }
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

function sameAnnotations(a: ReturnType<typeof values>, b: ReturnType<typeof values>): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    if (!other) return false;
    const { appearanceBytes: firstStream, ...first } = item;
    const { appearanceBytes: secondStream, ...second } = other;
    return JSON.stringify(first) === JSON.stringify(second) && sameBytes(firstStream, secondStream);
  });
}

/** Checks the actual source and result bytes, never caller-provided fidelity labels. */
export async function verifyPdfSourceBoundExport380(
  source: Uint8Array, output: Uint8Array, plan: PdfSourceBoundPlan380, signal?: AbortSignal,
): Promise<void> {
  abort(signal);
  if (plan.kind !== "page-transfer") refusal("Modello di editing senza verifica semantica");
  if (!(source instanceof Uint8Array) || !(output instanceof Uint8Array) ||
      source.length < 8 || source.length > PDF_LIMITS.maxBytes ||
      output.length < 8 || output.length > PDF_LIMITS.maxOutputBytes) refusal("Byte PDF fuori limite");
  const before = parsePdf(source);
  const after = parsePdf(output);
  inspectModel(before);
  inspectModel(after);
  const pages = plan.sourcePages;
  if (!Array.isArray(pages) || pages.length === 0 || pages.length !== after.pages.length ||
      new Set(pages).size !== pages.length ||
      pages.some((page) => !Number.isInteger(page) || page < 1 || page > before.pages.length)) {
    refusal("Mappatura pagine di origine invalida");
  }
  const beforeInspection = inspectPdfBytes(source);
  const afterInspection = inspectPdfBytes(output);
  const [original, exported] = await Promise.all([
    PDFDocument.load(source.slice(), { ignoreEncryption: false, updateMetadata: false }),
    PDFDocument.load(output.slice(), { ignoreEncryption: false, updateMetadata: false }),
  ]);
  if (original.getPageCount() !== before.pages.length || exported.getPageCount() !== pages.length ||
      beforeInspection.pageCount !== before.pages.length || afterInspection.pageCount !== pages.length) {
    throw new Error("PDF_VERIFY: Conteggio pagine non coerente");
  }
  const [textBefore, textAfter] = await Promise.all([extractPdfText(source, signal), extractPdfText(output, signal)]);
  for (const [index, pageId] of pages.entries()) {
    abort(signal);
    const left = original.getPage(pageId - 1), right = exported.getPage(index);
    const sourcePage = beforeInspection.pages[pageId - 1], outputPage = afterInspection.pages[index];
    if (!sourcePage || !outputPage ||
        Math.abs(left.getWidth() - right.getWidth()) > 0.01 ||
        Math.abs(left.getHeight() - right.getHeight()) > 0.01 ||
        left.getRotation().angle !== right.getRotation().angle ||
        sourcePage.imageCount !== outputPage.imageCount ||
        sourcePage.annotationCount !== outputPage.annotationCount ||
        textBefore[pageId - 1]?.truncated || textAfter[index]?.truncated ||
        textBefore[pageId - 1]?.text !== textAfter[index]?.text ||
        !sameAnnotations(values(before, pageId), values(after, index + 1))) {
      throw new Error("PDF_VERIFY: Testo, immagini, annotazioni o geometria non conservati dalla sorgente");
    }
  }
  abort(signal);
}

/** Annotation-preserving page copies use the native pdf-lib writer. */
export async function copyAnnotatedPages380(source: Uint8Array, pages: readonly number[]): Promise<Uint8Array> {
  const original = await PDFDocument.load(source.slice(), { ignoreEncryption: false, updateMetadata: false });
  const output = await PDFDocument.create();
  const copied = await output.copyPages(original, pages.map((page) => page - 1));
  copied.forEach((page) => output.addPage(page));
  return output.save({ useObjectStreams: false, addDefaultPage: false });
}

export function hasSourceAnnotations380(source: Uint8Array): boolean {
  const parsed = parsePdf(source);
  inspectModel(parsed);
  return parsed.pages.some((_, index) => values(parsed, index + 1).length > 0);
}
