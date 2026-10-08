import { parsePdfPageSelection } from "./page-selection";
import {
  arrayOrNull, dictionaryOrNull, numberValue, parsePdf, pdfArray, pdfDict, pdfName, pdfNumber,
  pdfReference, resolveReference, type PdfDictionary, type PdfDocumentModel, type PdfPageNode,
  type PdfStream, type PdfValue,
} from "./parser";
import { buildPdfFromPages } from "./writer";
import { PDF_LIMITS, type PdfArtifact } from "./types";

export type PdfWatermarkPosition = "top-left" | "top-center" | "top-right" |
  "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right";

export interface PdfWatermarkOptions {
  readonly pages: string;
  readonly text: string;
  /** 0.1 to 1.0, applied via a separate ExtGState transparency dictionary. */
  readonly opacity?: number;
  /** Clockwise on the displayed page, -180 to 180 degrees. */
  readonly rotation?: number;
  /** Text relative to a 36pt Helvetica base, 0.5..3.0. */
  readonly scale?: number;
  readonly position?: PdfWatermarkPosition;
  /** Display-page edge inset 12..72 PDF points. */
  readonly margin?: number;
}

export interface PdfWatermarkPlacement {
  readonly page: number;
  readonly text: string;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly pageRotation: 0 | 90 | 180 | 270;
  /** Display-space center of text, in PDF points measured from bottom-left. */
  readonly x: number;
  readonly y: number;
  readonly fontSize: number;
  readonly textWidth: number;
  readonly angle: number;
  readonly opacity: number;
  readonly position: PdfWatermarkPosition;
  /** PDF user-space text matrix, center aligned and upright on rotated pages. */
  readonly matrix: readonly [number, number, number, number, number, number];
}

export interface PdfWatermarkPlan {
  readonly pageCount: number;
  readonly selectedPages: readonly number[];
  readonly placements: readonly PdfWatermarkPlacement[];
  readonly note: "VISIBLE_OVERLAY_NOT_REDACTION";
}

function inRange(name: string, value: number, min: number, max: number) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`INVALID_INPUT: ${name} deve essere tra ${min} e ${max}`);
}

function checkedOptions(input: PdfWatermarkOptions): Required<PdfWatermarkOptions> {
  if (typeof input.pages !== "string") throw new Error("INVALID_INPUT: Indica un intervallo di pagine");
  const text = input.text;
  // Helvetica WinAnsi base font: ASCII only; prohibit control chars and PDF
  // injection by permitting printable ASCII and escaping PDF literals later.
  if (typeof text !== "string" || text.trim().length === 0 || text.length > 48 || !/^[\x20-\x7e]+$/u.test(text)) {
    throw new Error("INVALID_INPUT: Filigrana testuale da 1 a 48 caratteri ASCII stampabili");
  }
  const opacity = input.opacity ?? 0.3;
  const rotation = input.rotation ?? -35;
  const scale = input.scale ?? 1;
  const margin = input.margin ?? 24;
  const position = input.position ?? "center";
  inRange("Opacità", opacity, 0.1, 1);
  inRange("Rotazione", rotation, -180, 180);
  inRange("Scala", scale, 0.5, 3);
  inRange("Margine", margin, 12, 72);
  if (!["top-left", "top-center", "top-right", "center-left", "center", "center-right",
    "bottom-left", "bottom-center", "bottom-right"].includes(position)) throw new Error("INVALID_INPUT: Posizione watermark non valida");
  return { pages: input.pages, text, opacity, rotation, scale, margin, position };
}

function rectangle(model: PdfDocumentModel, value: PdfValue | undefined, label: string): [number, number, number, number] {
  const values = arrayOrNull(model, value)?.items.map(numberValue);
  if (values?.length !== 4 || values.some((value) => value === null)) throw new Error(`UNSUPPORTED_CAPABILITY: ${label} assente o non valido`);
  const [x0, y0, x1, y1] = values as [number, number, number, number];
  if (![x0, y0, x1, y1].every((n) => Number.isFinite(n) && Math.abs(n) <= PDF_LIMITS.maxPageDimension)
    || x1 <= x0 || y1 <= y0) throw new Error(`UNSUPPORTED_CAPABILITY: ${label} fuori limiti`);
  return [x0, y0, x1, y1];
}

function geometry(model: PdfDocumentModel, node: PdfPageNode) {
  const value = node.object.value;
  if (value.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Dizionario pagina PDF mancante");
  const media = rectangle(model, value.entries.get("MediaBox") ?? node.inherited.MediaBox, "MediaBox");
  const crop = rectangle(model, value.entries.get("CropBox") ?? node.inherited.CropBox ?? value.entries.get("MediaBox") ?? node.inherited.MediaBox, "CropBox");
  if (crop[0] < media[0] || crop[1] < media[1] || crop[2] > media[2] || crop[3] > media[3]) {
    throw new Error("UNSUPPORTED_CAPABILITY: CropBox fuori MediaBox");
  }
  const unit = numberValue(resolveReference(model, value.entries.get("UserUnit")));
  if (unit !== null && unit !== 1) throw new Error("UNSUPPORTED_CAPABILITY: UserUnit non supportato");
  const rotate = numberValue(resolveReference(model, value.entries.get("Rotate") ?? node.inherited.Rotate)) ?? 0;
  if (!Number.isInteger(rotate) || rotate % 90 !== 0) throw new Error("UNSUPPORTED_CAPABILITY: Rotazione pagina non multipla di 90°");
  const pageRotation = ((rotate % 360) + 360) % 360 as 0 | 90 | 180 | 270;
  const w = crop[2] - crop[0], h = crop[3] - crop[1];
  return { crop, pageRotation, width: pageRotation % 180 ? h : w, height: pageRotation % 180 ? w : h };
}

function placement(page: number, model: PdfDocumentModel, node: PdfPageNode, opt: Required<PdfWatermarkOptions>): PdfWatermarkPlacement {
  const { crop, pageRotation, width, height } = geometry(model, node);
  const fontSize = 36 * opt.scale;
  const textWidth = opt.text.length * fontSize * 0.556;
  // Since rotation may extend the text vertically, require the entire rotated
  // bounding rectangle to fit at the desired anchor (no invisible overlay).
  const theta = -opt.rotation * Math.PI / 180;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const boxWidth = Math.abs(textWidth * cos) + Math.abs(fontSize * sin);
  const boxHeight = Math.abs(textWidth * sin) + Math.abs(fontSize * cos);
  if (boxWidth + opt.margin * 2 > width || boxHeight + opt.margin * 2 > height) {
    throw new Error(`INVALID_INPUT: Filigrana troppo grande o ruotata per pagina ${page} (${width}×${height})`);
  }
  const horizontal = opt.position.endsWith("left") ? "left" : opt.position.endsWith("right") ? "right" : "center";
  const vertical = opt.position.startsWith("top") ? "top" : opt.position.startsWith("bottom") ? "bottom" : "center";
  const x = horizontal === "left" ? opt.margin + boxWidth / 2 : horizontal === "right" ? width - opt.margin - boxWidth / 2 : width / 2;
  const y = vertical === "top" ? height - opt.margin - boxHeight / 2 : vertical === "bottom" ? opt.margin + boxHeight / 2 : height / 2;
  // Text starts at -textWidth/2 horizontally, near optical center vertically.
  const baseX = x + cos * (-textWidth / 2) - sin * (-fontSize * 0.34);
  const baseY = y + sin * (-textWidth / 2) + cos * (-fontSize * 0.34);
  const originalWidth = crop[2] - crop[0], originalHeight = crop[3] - crop[1];
  const pageTransform: readonly [number, number, number, number, number, number] = pageRotation === 0
    ? [1, 0, 0, 1, crop[0], crop[1]]
    : pageRotation === 90 ? [0, 1, -1, 0, crop[0] + originalWidth, crop[1]]
      : pageRotation === 180 ? [-1, 0, 0, -1, crop[0] + originalWidth, crop[1] + originalHeight]
        : [0, -1, 1, 0, crop[0], crop[1] + originalHeight];
  const [a, b, c, d, e, f] = pageTransform;
  const matrix: readonly [number, number, number, number, number, number] = [
    a * cos + c * sin, b * cos + d * sin, -a * sin + c * cos, -b * sin + d * cos,
    a * baseX + c * baseY + e, b * baseX + d * baseY + f,
  ];
  return { page, text: opt.text, displayWidth: width, displayHeight: height, pageRotation,
    x, y, fontSize, textWidth, angle: opt.rotation, opacity: opt.opacity, position: opt.position, matrix };
}

export function planPdfWatermark(bytes: Uint8Array, options: PdfWatermarkOptions): PdfWatermarkPlan {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 || bytes.length > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: PDF fuori limite");
  const model = parsePdf(bytes);
  if (model.encrypted || model.pages.length === 0) throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato o senza pagine");
  const opt = checkedOptions(options);
  const selectedPages = parsePdfPageSelection(opt.pages, model.pages.length).sort((a, b) => a - b);
  return { pageCount: model.pages.length, selectedPages, note: "VISIBLE_OVERLAY_NOT_REDACTION",
    placements: selectedPages.map((page) => placement(page, model, model.pages[page - 1]!, opt)) };
}

function pageContents(model: PdfDocumentModel, node: PdfPageNode): readonly PdfValue[] {
  const value = node.object.value;
  if (value.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Dizionario pagina mancante");
  const source = value.entries.get("Contents");
  if (source === undefined) return [];
  const resolved = resolveReference(model, source);
  if (resolved?.kind === "stream" && source.kind === "ref") return [source];
  if (resolved?.kind === "array" && resolved.items.every((item) => item.kind === "ref" && resolveReference(model, item)?.kind === "stream")) return resolved.items;
  throw new Error("UNSUPPORTED_CAPABILITY: Contents PDF non indiretti");
}

function extendResources(model: PdfDocumentModel, node: PdfPageNode, fontId: number, gsId: number): PdfDictionary {
  const value = node.object.value;
  if (value.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Dizionario pagina mancante");
  const original = value.entries.get("Resources") ?? node.inherited.Resources;
  const resources = original === undefined ? pdfDict({}) : dictionaryOrNull(model, original);
  if (resources === null) throw new Error("UNSUPPORTED_CAPABILITY: Resources PDF non leggibili");
  const font = resources.entries.get("Font") === undefined ? pdfDict({}) : dictionaryOrNull(model, resources.entries.get("Font"));
  const ext = resources.entries.get("ExtGState") === undefined ? pdfDict({}) : dictionaryOrNull(model, resources.entries.get("ExtGState"));
  if (font === null || ext === null) throw new Error("UNSUPPORTED_CAPABILITY: Font/ExtGState PDF non leggibili");
  if (font.entries.has("WM239F") || ext.entries.has("WM239G")) throw new Error("UNSUPPORTED_CAPABILITY: Risorsa watermark già esistente");
  return { kind: "dict", entries: new Map([...resources.entries,
    ["Font", { kind: "dict", entries: new Map([...font.entries, ["WM239F", pdfReference(fontId)]]) }],
    ["ExtGState", { kind: "dict", entries: new Map([...ext.entries, ["WM239G", pdfReference(gsId)]]) }],
  ]) };
}

function drawOverlay(place: PdfWatermarkPlacement): PdfStream {
  const literal = place.text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const matrix = place.matrix.map((n) => Number(n.toFixed(5))).join(" ");
  return { kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(
    `q\n/WM239G gs\nBT /WM239F ${Number(place.fontSize.toFixed(4))} Tf 0.5 g ${matrix} Tm (${literal}) Tj ET\nQ\n`) };
}

export function watermarkPdf(bytes: Uint8Array, options: PdfWatermarkOptions, signal?: AbortSignal): { artifact: PdfArtifact; plan: PdfWatermarkPlan } {
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  const plan = planPdfWatermark(bytes, options);
  const parsed = parsePdf(bytes);
  const objects = new Map(parsed.objects);
  let nextId = Math.max(...objects.keys()) + 1;
  const fontId = nextId++;
  const gsId = nextId++;
  const opacity = plan.placements[0]!.opacity;
  objects.set(fontId, { id: fontId, generation: 0,
    value: pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica"), Encoding: pdfName("WinAnsiEncoding") }) });
  objects.set(gsId, { id: gsId, generation: 0,
    value: pdfDict({ Type: pdfName("ExtGState"), CA: pdfNumber(opacity), ca: pdfNumber(opacity), BM: pdfName("Normal") }) });
  const chosen = new Map(plan.placements.map((p) => [p.page, p]));
  const updated = parsed.pages.map((node, index): PdfPageNode => {
    const place = chosen.get(index + 1);
    if (place === undefined) return node;
    if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
    const value = node.object.value;
    if (value.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Pagina PDF non valida");
    const overlayId = nextId++;
    objects.set(overlayId, { id: overlayId, generation: 0, value: drawOverlay(place) });
    const updatedValue: PdfDictionary = { kind: "dict", entries: new Map([...value.entries,
      ["Contents", pdfArray([...pageContents(parsed, node), pdfReference(overlayId)])],
      ["Resources", extendResources(parsed, node, fontId, gsId)],
    ]) };
    return { object: { ...node.object, value: updatedValue }, inherited: node.inherited };
  });
  const model: PdfDocumentModel = { ...parsed, objects, pages: updated };
  const output = buildPdfFromPages(updated.map((page) => ({ document: model, page })), { flatten: false, compress: false, stripMetadata: false });
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  const verified = parsePdf(output);
  if (verified.pages.length !== parsed.pages.length) throw new Error("PDF_OUTPUT_MISMATCH: Numero pagine cambiato");
  for (let p = 0; p < parsed.pages.length; p++) {
    const originals = pageContents(parsed, parsed.pages[p]!);
    const copied = pageContents(verified, verified.pages[p]!);
    if (copied.length !== originals.length + (chosen.has(p + 1) ? 1 : 0)) throw new Error("PDF_OUTPUT_MISMATCH: Contents stream count changed");
    for (let i = 0; i < originals.length; i++) {
      const a = resolveReference(parsed, originals[i]);
      const b = resolveReference(verified, copied[i]);
      if (a?.kind !== "stream" || b?.kind !== "stream" || a.bytes.length !== b.bytes.length || a.bytes.some((byte, at) => byte !== b.bytes[at])) {
        throw new Error(`PDF_OUTPUT_MISMATCH: Contents originali pagina ${p + 1} modificati`);
      }
    }
    const g0 = geometry(parsed, parsed.pages[p]!);
    const g1 = geometry(verified, verified.pages[p]!);
    if (g0.width !== g1.width || g0.height !== g1.height || g0.pageRotation !== g1.pageRotation) throw new Error("PDF_OUTPUT_MISMATCH: Geometria modificata");
  }
  const artifactBytes = Uint8Array.from(output);
  return { artifact: { bytes: artifactBytes, blob: new Blob([artifactBytes], { type: "application/pdf" }), mime: "application/pdf",
    filename: "pdf-filigranato.pdf", pageCount: verified.pages.length }, plan };
}
