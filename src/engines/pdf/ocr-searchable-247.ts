import {
  arrayOrNull, dictionaryOrNull, numberValue, parsePdf, pdfArray, pdfDict, pdfName,
  pdfReference, resolveReference, type PdfDocumentModel,
  type PdfPageNode, type PdfValue,
} from "./parser";
import { buildPdfFromPages } from "./writer";

/** Experimental #247 output scope: original page streams remain byte-identical. */
export interface OcrWord247 {
  readonly text: string;
  readonly confidence: number;
  readonly bbox: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
}
export interface OcrPage247 {
  readonly page: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly words: readonly OcrWord247[];
}

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 3;
const MAX_WORDS = 450;
const MAX_WORD_CHARS = 90;
const windows1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

function scannedWordHex(text: string): string {
  const bytes: number[] = [];
  for (const char of text) {
    const value = char.codePointAt(0)!;
    const byte = windows1252[value] ?? (value >= 0x20 && value <= 0x7e ? value :
      value >= 0xa0 && value <= 0xff ? value : null);
    if (byte === null) throw new Error("OCR247_UNSUPPORTED_GLYPH: OCR contiene caratteri fuori dal font WinAnsi verificato");
    bytes.push(byte);
  }
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function contents(model: PdfDocumentModel, page: PdfPageNode): readonly PdfValue[] {
  const dict = page.object.value;
  if (dict.kind !== "dict") throw new Error("OCR247_UNSUPPORTED_PAGE: dizionario pagina assente");
  const value = dict.entries.get("Contents");
  if (!value) return [];
  const resolved = resolveReference(model, value);
  if (value.kind === "ref" && resolved?.kind === "stream") return [value];
  if (resolved?.kind === "array" && resolved.items.every((item) => item.kind === "ref" && resolveReference(model, item)?.kind === "stream")) return resolved.items;
  throw new Error("OCR247_UNSUPPORTED_PAGE: stream pagina non indiretti");
}

function pageGeometry(model: PdfDocumentModel, page: PdfPageNode): { width: number; height: number } {
  const dict = page.object.value;
  if (dict.kind !== "dict") throw new Error("OCR247_UNSUPPORTED_PAGE");
  const media = arrayOrNull(model, dict.entries.get("MediaBox") ?? page.inherited.MediaBox)?.items.map(numberValue);
  const crop = arrayOrNull(model, dict.entries.get("CropBox") ?? page.inherited.CropBox)?.items.map(numberValue);
  const rotation = numberValue(resolveReference(model, dict.entries.get("Rotate") ?? page.inherited.Rotate)) ?? 0;
  const unit = numberValue(resolveReference(model, dict.entries.get("UserUnit"))) ?? 1;
  if (media?.length !== 4 || media.some((v) => v === null) ||
    media[0] !== 0 || media[1] !== 0 || (crop && crop.some((v, i) => v !== media[i])) ||
    rotation !== 0 || unit !== 1 || !Number.isFinite(media[2]) || !Number.isFinite(media[3]) ||
    media[2]! < 30 || media[3]! < 30 || media[2]! > 2000 || media[3]! > 2000) {
    throw new Error("OCR247_UNSUPPORTED_GEOMETRY: richiesti MediaBox zero-origin, CropBox uguale, rotazione 0, UserUnit 1");
  }
  return { width: media[2]!, height: media[3]! };
}

function invisibleOverlay(page: OcrPage247, width: number, height: number): Uint8Array {
  if (!Number.isInteger(page.imageWidth) || !Number.isInteger(page.imageHeight) ||
    page.imageWidth < 1 || page.imageHeight < 1 || page.imageWidth * page.imageHeight > 2_000_000 ||
    page.words.length < 1 || page.words.length > MAX_WORDS) throw new Error("OCR247_INVALID_WORDS");
  const sx = width / page.imageWidth, sy = height / page.imageHeight;
  const lines = ["q", "BT", "/F247 1 Tf", "3 Tr"]; // PDF text rendering mode 3: fully invisible, extractable.
  for (const word of page.words) {
    const { x0, y0, x1, y1 } = word.bbox;
    if (typeof word.text !== "string" || !word.text.trim() || word.text.length > MAX_WORD_CHARS ||
      word.text.includes("\n") || word.text.includes("\r") ||
      !Number.isFinite(word.confidence) || word.confidence < 0 || word.confidence > 100 ||
      ![x0, y0, x1, y1].every(Number.isFinite) || x0 < 0 || y0 < 0 || x1 > page.imageWidth || y1 > page.imageHeight ||
      x1 <= x0 || y1 <= y0) throw new Error("OCR247_INVALID_WORD_COORDINATES");
    // Put an explicit separator into the hidden text stream: PDF.js otherwise
    // infers word breaks from glyph gaps, which can join neighboring OCR words.
    const hex = scannedWordHex(word.text + " ");
    // Scale horizontal and vertical glyph axes to the measured Tesseract word bbox.
    // Exact typographic character geometry cannot be guaranteed by OCR and is not claimed.
    const textW = (x1 - x0) * sx;
    const textH = (y1 - y0) * sy;
    const a = textW / Math.max(0.3, [...word.text].length * 0.51);
    const d = textH * 0.82;
    const x = x0 * sx;
    const y = height - y1 * sy + textH * 0.12;
    lines.push(`${[a, 0, 0, d, x, y].map((v) => Number(v.toFixed(4))).join(" ")} Tm <${hex}> Tj`);
  }
  lines.push("ET", "Q");
  return new TextEncoder().encode(lines.join("\n") + "\n");
}

export function addInvisibleOcrLayer247(sourceBytes: Uint8Array, scannedPages: readonly OcrPage247[], signal?: AbortSignal): Uint8Array {
  const running = () => { if (signal?.aborted) throw new DOMException("OCR PDF annullato", "AbortError"); };
  running();
  if (!(sourceBytes instanceof Uint8Array) || sourceBytes.byteLength < 8 || sourceBytes.byteLength > MAX_SOURCE_BYTES) throw new Error("OCR247_INPUT_LIMIT");
  const source = parsePdf(sourceBytes);
  if (source.encrypted || source.pages.length < 1 || source.pages.length > MAX_PAGES ||
    source.text.includes("/ByteRange") || source.text.includes("/DocMDP")) throw new Error("OCR247_UNSUPPORTED_DOCUMENT");
  const root = source.root ? dictionaryOrNull(source, source.root) : null;
  if (!root || ["AA", "OpenAction", "Names", "Perms", "AcroForm"].some((key) => root.entries.has(key))) throw new Error("OCR247_UNSUPPORTED_INTERACTIVE_DOCUMENT");
  if (scannedPages.length < 1 || scannedPages.length > source.pages.length ||
    new Set(scannedPages.map((p) => p.page)).size !== scannedPages.length) throw new Error("OCR247_INVALID_PAGE_SELECTION");
  const overlays = new Map(scannedPages.map((p) => [p.page, p]));
  for (const p of scannedPages) if (!Number.isInteger(p.page) || p.page < 1 || p.page > source.pages.length) throw new Error("OCR247_INVALID_PAGE_SELECTION");
  const objects = new Map(source.objects);
  let id = Math.max(...objects.keys()) + 1;
  const fontId = id++;
  objects.set(fontId, { id: fontId, generation: 0, value: pdfDict({
    Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica"), Encoding: pdfName("WinAnsiEncoding"),
  }) });
  const updated = source.pages.map((node, index): PdfPageNode => {
    running();
    const original = node.object.value;
    if (original.kind !== "dict" || ["Annots", "AA", "A", "PresSteps"].some((key) => original.entries.has(key))) {
      throw new Error("OCR247_UNSUPPORTED_INTERACTIVE_PAGE");
    }
    const page = overlays.get(index + 1);
    if (!page) return node;
    const geometry = pageGeometry(source, node);
    const resources = dictionaryOrNull(source, original.entries.get("Resources") ?? node.inherited.Resources) ?? pdfDict({});
    const fonts = dictionaryOrNull(source, resources.entries.get("Font")) ?? pdfDict({});
    if (fonts.entries.has("F247")) throw new Error("OCR247_RESOURCE_COLLISION");
    const overlayId = id++;
    objects.set(overlayId, { id: overlayId, generation: 0, value: {
      kind: "stream", dictionary: pdfDict({}), bytes: invisibleOverlay(page, geometry.width, geometry.height),
    } });
    const entries = new Map<string, PdfValue>(original.entries);
    entries.set("Resources", { kind: "dict", entries: new Map([...resources.entries,
      ["Font", { kind: "dict", entries: new Map([...fonts.entries, ["F247", pdfReference(fontId)]]) }],
    ]) });
    entries.set("Contents", pdfArray([...contents(source, node), pdfReference(overlayId)]));
    return { ...node, object: { ...node.object, value: { kind: "dict", entries } } };
  });
  const augmented: PdfDocumentModel = { ...source, objects, pages: updated };
  const output = buildPdfFromPages(updated.map((page) => ({ document: augmented, page })), {
    flatten: false, stripMetadata: false, compress: false,
  });
  running();
  const reopened = parsePdf(output);
  if (reopened.pages.length !== source.pages.length) throw new Error("OCR247_OUTPUT_PAGE_COUNT_MISMATCH");
  for (const [index, original] of source.pages.entries()) {
    running();
    const inputContents = contents(source, original), outputContents = contents(reopened, reopened.pages[index]!);
    if (outputContents.length !== inputContents.length + (overlays.has(index + 1) ? 1 : 0)) throw new Error("OCR247_OUTPUT_STREAM_COUNT_MISMATCH");
    for (let c = 0; c < inputContents.length; c += 1) {
      const a = resolveReference(source, inputContents[c]), b = resolveReference(reopened, outputContents[c]);
      if (a?.kind !== "stream" || b?.kind !== "stream" || a.bytes.length !== b.bytes.length ||
        a.bytes.some((v, i) => v !== b.bytes[i])) throw new Error("OCR247_OUTPUT_ORIGINAL_CONTENT_CHANGED");
    }
  }
  return output;
}
