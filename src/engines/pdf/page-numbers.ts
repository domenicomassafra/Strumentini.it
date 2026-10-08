import { parsePdfPageSelection } from "./page-selection";
import {
  arrayOrNull, dictionaryOrNull, numberValue, parsePdf, pdfArray, pdfDict, pdfName,
  pdfReference, resolveReference, type PdfDictionary, type PdfDocumentModel, type PdfPageNode, type PdfStream, type PdfValue,
} from "./parser";
import { buildPdfFromPages } from "./writer";
import { PDF_LIMITS, type PdfArtifact } from "./types";

export type PdfNumberPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
export type PdfNumberFont = "Helvetica" | "Courier" | "Times-Roman";

export interface PdfPageNumberOptions {
  /** 1-indexed strict range, e.g. `2-4,6`, `*`, or `ogni 2`. */
  readonly pages: string;
  /** First selected page's printed value before offset; 1..9999. */
  readonly startNumber?: number;
  /** Signed adjustment to printed values; -999..999; labels must remain positive. */
  readonly offset?: number;
  readonly position?: PdfNumberPosition;
  readonly font?: PdfNumberFont;
  readonly fontSize?: number;
  /** Distance in PDF points from the displayed page's CropBox edge; 8..72. */
  readonly margin?: number;
}

export interface PdfNumberPlacement {
  readonly page: number;
  readonly label: string;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly rotation: 0 | 90 | 180 | 270;
  readonly x: number;
  /** Display-space text baseline in PDF points from the bottom. */
  readonly y: number;
  readonly fontSize: number;
  readonly font: PdfNumberFont;
  readonly position: PdfNumberPosition;
  /** Original unrotated PDF user-space text matrix. */
  readonly matrix: readonly [number, number, number, number, number, number];
}

export interface PdfPageNumberPlan {
  readonly pageCount: number;
  readonly selectedPages: readonly number[];
  readonly placements: readonly PdfNumberPlacement[];
  readonly font: PdfNumberFont;
  readonly fontSize: number;
  readonly margin: number;
}

function assertNumber(name: string, value: number, min: number, max: number, integer = false): void {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`INVALID_INPUT: ${name} deve essere ${integer ? "intero " : ""}tra ${min} e ${max}`);
  }
}

function rectangle(model: PdfDocumentModel, value: PdfValue | undefined, label: string): [number, number, number, number] {
  const items = arrayOrNull(model, value)?.items.map(numberValue);
  if (items?.length !== 4 || items.some((item) => item === null)) throw new Error(`UNSUPPORTED_CAPABILITY: ${label} non valido`);
  const [x0, y0, x1, y1] = items as [number, number, number, number];
  if (![x0, y0, x1, y1].every((n) => Number.isFinite(n) && Math.abs(n) <= PDF_LIMITS.maxPageDimension) || x1 <= x0 || y1 <= y0) {
    throw new Error(`UNSUPPORTED_CAPABILITY: ${label} non normalizzato o fuori limite`);
  }
  return [x0, y0, x1, y1];
}

function geometry(model: PdfDocumentModel, node: PdfPageNode): { crop: [number, number, number, number]; rotation: 0 | 90 | 180 | 270; width: number; height: number } {
  const dict = node.object.value;
  if (dict.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Pagina PDF non valida");
  const media = rectangle(model, dict.entries.get("MediaBox") ?? node.inherited.MediaBox, "MediaBox");
  const crop = rectangle(model, dict.entries.get("CropBox") ?? node.inherited.CropBox ?? dict.entries.get("MediaBox") ?? node.inherited.MediaBox, "CropBox");
  if (crop[0] < media[0] || crop[1] < media[1] || crop[2] > media[2] || crop[3] > media[3]) {
    throw new Error("UNSUPPORTED_CAPABILITY: CropBox esterna alla MediaBox");
  }
  const rotation = numberValue(resolveReference(model, dict.entries.get("Rotate") ?? node.inherited.Rotate)) ?? 0;
  if (!Number.isInteger(rotation) || rotation % 90 !== 0) throw new Error("UNSUPPORTED_CAPABILITY: Rotazione PDF non multipla di 90°");
  const normalized = ((rotation % 360) + 360) % 360 as 0 | 90 | 180 | 270;
  const userUnit = numberValue(resolveReference(model, dict.entries.get("UserUnit")));
  if (userUnit !== null && userUnit !== 1) throw new Error("UNSUPPORTED_CAPABILITY: UserUnit personalizzato non supportato");
  const w = crop[2] - crop[0];
  const h = crop[3] - crop[1];
  return { crop, rotation: normalized, width: normalized % 180 === 0 ? w : h, height: normalized % 180 === 0 ? h : w };
}

function assertOptions(options: PdfPageNumberOptions): Required<PdfPageNumberOptions> {
  if (typeof options.pages !== "string") throw new Error("INVALID_INPUT: Indicare le pagine");
  const startNumber = options.startNumber ?? 1;
  const offset = options.offset ?? 0;
  const position = options.position ?? "bottom-center";
  const font = options.font ?? "Helvetica";
  const fontSize = options.fontSize ?? 12;
  const margin = options.margin ?? 24;
  assertNumber("Numero iniziale", startNumber, 1, 9999, true);
  assertNumber("Offset", offset, -999, 999, true);
  assertNumber("Dimensione font", fontSize, 8, 36);
  assertNumber("Margine", margin, 8, 72);
  if (!["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"].includes(position)) {
    throw new Error("INVALID_INPUT: Posizione numero non valida");
  }
  if (!["Helvetica", "Courier", "Times-Roman"].includes(font)) throw new Error("INVALID_INPUT: Font PDF non supportato");
  return { ...options, startNumber, offset, position, font, fontSize, margin };
}

function placeNumber(page: number, label: string, model: PdfDocumentModel, node: PdfPageNode, options: Required<PdfPageNumberOptions>): PdfNumberPlacement {
  const { crop, rotation, width, height } = geometry(model, node);
  const glyphWidth = options.font === "Courier" ? 0.6 : options.font === "Times-Roman" ? 0.5 : 0.556;
  const textWidth = label.length * options.fontSize * glyphWidth;
  if (width < 2 * options.margin + textWidth || height < 2 * options.margin + options.fontSize) {
    throw new Error(`INVALID_INPUT: Pagina ${page}: font/margini non compatibili con la geometria reale`);
  }
  const x = options.position.endsWith("left") ? options.margin
    : options.position.endsWith("right") ? width - options.margin - textWidth : (width - textWidth) / 2;
  const y = options.position.startsWith("top") ? height - options.margin - options.fontSize : options.margin;
  const originalWidth = crop[2] - crop[0];
  const originalHeight = crop[3] - crop[1];
  const matrix: readonly [number, number, number, number, number, number] = rotation === 0
    ? [1, 0, 0, 1, crop[0] + x, crop[1] + y]
    : rotation === 90 ? [0, 1, -1, 0, crop[0] + originalWidth - y, crop[1] + x]
      : rotation === 180 ? [-1, 0, 0, -1, crop[0] + originalWidth - x, crop[1] + originalHeight - y]
        : [0, -1, 1, 0, crop[0] + y, crop[1] + originalHeight - x];
  return { page, label, displayWidth: width, displayHeight: height, rotation, x, y,
    fontSize: options.fontSize, font: options.font, position: options.position, matrix };
}

export function planPdfPageNumbers(source: Uint8Array, supplied: PdfPageNumberOptions): PdfPageNumberPlan {
  if (!(source instanceof Uint8Array) || source.byteLength < 8 || source.byteLength > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: Dimensione PDF non valida");
  const model = parsePdf(source);
  if (model.encrypted || model.pages.length === 0) throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato o senza pagine");
  const options = assertOptions(supplied);
  const pages = parsePdfPageSelection(options.pages, model.pages.length).sort((a, b) => a - b);
  const placements = pages.map((page, index) => {
    const number = options.startNumber + options.offset + index;
    if (number < 1 || number > 99999) throw new Error("INVALID_INPUT: Numero pagina risultante fuori intervallo");
    return placeNumber(page, String(number), model, model.pages[page - 1]!, options);
  });
  return { pageCount: model.pages.length, selectedPages: pages, placements,
    font: options.font, fontSize: options.fontSize, margin: options.margin };
}

function assertContents(model: PdfDocumentModel, node: PdfPageNode): readonly PdfValue[] {
  const dict = node.object.value;
  if (dict.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Page dictionary assente");
  const original = dict.entries.get("Contents");
  if (original === undefined) return [];
  const resolved = resolveReference(model, original);
  if (resolved?.kind === "stream") {
    if (original.kind !== "ref") throw new Error("UNSUPPORTED_CAPABILITY: Contents stream diretto non supportato");
    return [original];
  }
  if (resolved?.kind === "array") {
    if (resolved.items.some((item) => item.kind !== "ref" || resolveReference(model, item)?.kind !== "stream")) {
      throw new Error("UNSUPPORTED_CAPABILITY: Array Contents contiene stream non indiretti");
    }
    return resolved.items;
  }
  throw new Error("UNSUPPORTED_CAPABILITY: Contents non supportato");
}

function fontResources(model: PdfDocumentModel, node: PdfPageNode, fontRef: PdfValue): PdfDictionary {
  const page = node.object.value;
  if (page.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Page non valida");
  const resourceValue = page.entries.get("Resources") ?? node.inherited.Resources;
  const resources = resourceValue === undefined ? pdfDict({}) : dictionaryOrNull(model, resourceValue);
  if (resources === null) throw new Error("UNSUPPORTED_CAPABILITY: Risorse PDF non leggibili");
  const fontsValue = resources.entries.get("Font");
  const fonts = fontsValue === undefined ? pdfDict({}) : dictionaryOrNull(model, fontsValue);
  if (fonts === null) throw new Error("UNSUPPORTED_CAPABILITY: Dizionario font PDF non leggibile");
  if (fonts.entries.has("PN238")) throw new Error("UNSUPPORTED_CAPABILITY: Nome font PN238 già occupato");
  const updatedFonts = { kind: "dict" as const, entries: new Map([...fonts.entries, ["PN238", fontRef]]) };
  return { kind: "dict", entries: new Map([...resources.entries, ["Font", updatedFonts]]) };
}

function overlayStream(placement: PdfNumberPlacement): PdfStream {
  // Only validated decimal digits appear inside the literal string.
  const tm = placement.matrix.map((n) => Number(n.toFixed(4))).join(" ");
  return { kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(
    `q\nBT /PN238 ${placement.fontSize} Tf 0 g ${tm} Tm (${placement.label}) Tj ET\nQ\n`) };
}

function assertUnchangedContent(source: PdfDocumentModel, output: PdfDocumentModel, selected: readonly number[]): void {
  const originals = source.pages;
  if (output.pages.length !== originals.length) throw new Error("PDF_OUTPUT_MISMATCH: Numero pagine modificato");
  const selectedSet = new Set(selected);
  for (let index = 0; index < originals.length; index += 1) {
    const originalContents = assertContents(source, originals[index]!);
    const resultContents = assertContents(output, output.pages[index]!);
    if (resultContents.length !== originalContents.length + (selectedSet.has(index + 1) ? 1 : 0)) {
      throw new Error(`PDF_OUTPUT_MISMATCH: Stream di pagina ${index + 1} non preservati`);
    }
    for (let i = 0; i < originalContents.length; i += 1) {
      const before = resolveReference(source, originalContents[i]);
      const after = resolveReference(output, resultContents[i]);
      if (before?.kind !== "stream" || after?.kind !== "stream" || before.bytes.length !== after.bytes.length ||
        before.bytes.some((byte, at) => byte !== after.bytes[at])) {
        throw new Error(`PDF_OUTPUT_MISMATCH: Contenuto originale della pagina ${index + 1} alterato`);
      }
    }
  }
}

export function numberPdfPages(source: Uint8Array, options: PdfPageNumberOptions, signal?: AbortSignal): { artifact: PdfArtifact; plan: PdfPageNumberPlan } {
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  const plan = planPdfPageNumbers(source, options);
  const parsed = parsePdf(source);
  // New source-model refs permit a completely separate overlay stream for each
  // page; the original /Contents streams are copied byte-for-byte, never edited.
  const objects = new Map(parsed.objects);
  let nextId = Math.max(0, ...objects.keys()) + 1;
  const fontId = nextId++;
  objects.set(fontId, { id: fontId, generation: 0,
    value: pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName(plan.font), Encoding: pdfName("WinAnsiEncoding") }) });
  const placements = new Map(plan.placements.map((placement) => [placement.page, placement]));
  const newPages = parsed.pages.map((node, index): PdfPageNode => {
    const placement = placements.get(index + 1);
    if (placement === undefined) return node;
    if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
    const original = node.object.value;
    if (original.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Page dictionary assente");
    const contents = assertContents(parsed, node);
    const overlayId = nextId++;
    objects.set(overlayId, { id: overlayId, generation: 0, value: overlayStream(placement) });
    const resources = fontResources(parsed, node, pdfReference(fontId));
    const value: PdfDictionary = { kind: "dict", entries: new Map([
      ...original.entries,
      ["Contents", pdfArray([...contents, pdfReference(overlayId)])],
      ["Resources", resources],
    ]) };
    return { object: { ...node.object, value }, inherited: node.inherited };
  });
  const augmented: PdfDocumentModel = { ...parsed, objects, pages: newPages };
  const bytes = buildPdfFromPages(newPages.map((page) => ({ document: augmented, page })), {
    flatten: false, stripMetadata: false, compress: false,
  });
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  const result = parsePdf(bytes);
  assertUnchangedContent(parsed, result, plan.selectedPages);
  for (let i = 0; i < parsed.pages.length; i += 1) {
    const a = geometry(parsed, parsed.pages[i]!);
    const b = geometry(result, result.pages[i]!);
    if (a.width !== b.width || a.height !== b.height || a.rotation !== b.rotation) {
      throw new Error("PDF_OUTPUT_MISMATCH: Geometria pagina cambiata");
    }
  }
  const output = Uint8Array.from(bytes);
  return { artifact: { bytes: output, blob: new Blob([output], { type: "application/pdf" }), mime: "application/pdf",
    filename: "pdf-numerato.pdf", pageCount: plan.pageCount }, plan };
}
