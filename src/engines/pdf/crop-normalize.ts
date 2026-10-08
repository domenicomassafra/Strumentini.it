import { parsePdfPageSelection } from "./page-selection";
import {
  arrayOrNull, numberValue, parsePdf, pdfArray, pdfNumber, pdfReference, resolveReference,
  type PdfDocumentModel, type PdfPageNode, type PdfValue, type PdfDictionary,
} from "./parser";
import { buildPdfFromPages } from "./writer";
import { PDF_LIMITS, type PdfArtifact } from "./types";

export type PdfCropNormalizeMode = "crop" | "normalize";
export type PdfPageSizePreset = "a4-portrait" | "a4-landscape" | "letter-portrait" | "letter-landscape" | "custom";
export type PdfPageFit = "contain" | "center";
export interface PdfCropNormalizeOptions {
  readonly mode: PdfCropNormalizeMode;
  readonly pages: string;
  /** Crop removes only visibility. Insets are PDF pt in *display orientation*, measured from current CropBox. */
  readonly insetLeft?: number;
  readonly insetTop?: number;
  readonly insetRight?: number;
  readonly insetBottom?: number;
  readonly preset?: PdfPageSizePreset;
  readonly customWidth?: number;
  readonly customHeight?: number;
  /** contain scales uniformly and centers (never clips); center uses scale 1 only if content fits. */
  readonly fit?: PdfPageFit;
  readonly margin?: number;
}
export interface PdfPageBoxPlan {
  readonly page: number;
  readonly originalMedia: readonly [number, number, number, number];
  readonly originalCrop: readonly [number, number, number, number];
  readonly sourceRotation: 0 | 90 | 180 | 270;
  readonly sourceVisibleWidth: number;
  readonly sourceVisibleHeight: number;
  readonly resultMedia: readonly [number, number, number, number];
  readonly resultCrop: readonly [number, number, number, number];
  readonly resultRotation: 0 | 90 | 180 | 270;
  readonly displayedWidth: number;
  readonly displayedHeight: number;
  readonly scale: number;
  readonly displayedOffsetX: number;
  readonly displayedOffsetY: number;
  readonly transform: readonly [number, number, number, number, number, number] | null;
}
export interface PdfCropNormalizePlan {
  readonly mode: PdfCropNormalizeMode;
  readonly selectedPages: readonly number[];
  readonly pageCount: number;
  readonly pages: readonly PdfPageBoxPlan[];
  readonly warning: "CROP_HIDES_NOT_REDACTS" | "NORMALIZE_REFRAMES_ORIGINAL_CONTENT";
}

function validNumber(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`INVALID_INPUT: ${label} deve essere tra ${min} e ${max}`);
}
function rect(model: PdfDocumentModel, value: PdfValue | undefined, label: string): [number, number, number, number] {
  const parts = arrayOrNull(model, value)?.items.map(numberValue);
  if (parts?.length !== 4 || parts.some((v) => v === null)) throw new Error(`UNSUPPORTED_CAPABILITY: ${label} non valido`);
  const [x0, y0, x1, y1] = parts as [number, number, number, number];
  if (![x0, y0, x1, y1].every((v) => Number.isFinite(v) && Math.abs(v) <= PDF_LIMITS.maxPageDimension) || x1 <= x0 || y1 <= y0) {
    throw new Error(`UNSUPPORTED_CAPABILITY: ${label} fuori limite`);
  }
  return [x0, y0, x1, y1];
}
function sourceBox(model: PdfDocumentModel, node: PdfPageNode) {
  const page = node.object.value;
  if (page.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Dizionario pagina mancante");
  const media = rect(model, page.entries.get("MediaBox") ?? node.inherited.MediaBox, "MediaBox");
  const crop = rect(model, page.entries.get("CropBox") ?? node.inherited.CropBox ?? page.entries.get("MediaBox") ?? node.inherited.MediaBox, "CropBox");
  if (crop[0] < media[0] || crop[1] < media[1] || crop[2] > media[2] || crop[3] > media[3]) {
    throw new Error("UNSUPPORTED_CAPABILITY: CropBox fuori MediaBox");
  }
  const rotation = numberValue(resolveReference(model, page.entries.get("Rotate") ?? node.inherited.Rotate)) ?? 0;
  if (!Number.isInteger(rotation) || rotation % 90 !== 0) throw new Error("UNSUPPORTED_CAPABILITY: /Rotate non multiplo di 90°");
  const normalized = ((rotation % 360) + 360) % 360 as 0 | 90 | 180 | 270;
  const unit = numberValue(resolveReference(model, page.entries.get("UserUnit")));
  if (unit !== null && unit !== 1) throw new Error("UNSUPPORTED_CAPABILITY: /UserUnit personalizzato non supportato");
  const w = crop[2] - crop[0], h = crop[3] - crop[1];
  return { media, crop, rotation: normalized, width: normalized % 180 === 0 ? w : h, height: normalized % 180 === 0 ? h : w };
}
function contents(model: PdfDocumentModel, node: PdfPageNode): readonly PdfValue[] {
  const page = node.object.value;
  if (page.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Pagina non valida");
  const original = page.entries.get("Contents");
  if (original === undefined) return [];
  const resolved = resolveReference(model, original);
  if (resolved?.kind === "stream" && original.kind === "ref") return [original];
  if (resolved?.kind === "array" && resolved.items.every((item) => item.kind === "ref" && resolveReference(model, item)?.kind === "stream")) return resolved.items;
  throw new Error("UNSUPPORTED_CAPABILITY: /Contents diretto o invalido; nessuna modifica effettuata");
}
const presetSizes: Record<Exclude<PdfPageSizePreset, "custom">, readonly [number, number]> = {
  "a4-portrait": [595.28, 841.89], "a4-landscape": [841.89, 595.28],
  "letter-portrait": [612, 792], "letter-landscape": [792, 612],
};
function matrixFor(rotation: 0 | 90 | 180 | 270, crop: readonly [number, number, number, number], scale: number, x: number, y: number): [number, number, number, number, number, number] {
  const [l, b, r, t] = crop;
  // Maps unrotated source user space into upright, displayed source orientation.
  if (rotation === 0) return [scale, 0, 0, scale, x - scale * l, y - scale * b];
  if (rotation === 90) return [0, -scale, scale, 0, x - scale * b, y + scale * r];
  if (rotation === 180) return [-scale, 0, 0, -scale, x + scale * r, y + scale * t];
  return [0, scale, -scale, 0, x + scale * t, y - scale * l];
}
function chosenOptions(opt: PdfCropNormalizeOptions) {
  if (opt.mode !== "crop" && opt.mode !== "normalize") throw new Error("INVALID_INPUT: Scegli crop o normalize");
  if (typeof opt.pages !== "string") throw new Error("INVALID_INPUT: Selezione pagine richiesta");
  if (opt.mode === "crop") {
    const insets = [opt.insetLeft ?? 0, opt.insetTop ?? 0, opt.insetRight ?? 0, opt.insetBottom ?? 0] as const;
    insets.forEach((v) => validNumber("Inset crop", v, 0, 2000));
    if (insets.every((v) => v === 0)) throw new Error("INVALID_INPUT: Specificare almeno un margine di crop maggiore di zero");
    return { insets, target: null, fit: "contain" as PdfPageFit, margin: 0 };
  }
  const preset = opt.preset ?? "a4-portrait";
  const target = preset === "custom" ? [opt.customWidth, opt.customHeight] : presetSizes[preset as keyof typeof presetSizes];
  if (!target || target.length !== 2) throw new Error("INVALID_INPUT: Formato pagina non supportato");
  const width = Number(target[0]), height = Number(target[1]);
  validNumber("Larghezza", width, 100, 2000);
  validNumber("Altezza", height, 100, 2000);
  const fit = opt.fit ?? "contain";
  if (!["contain", "center"].includes(fit)) throw new Error("INVALID_INPUT: Strategia scala non valida");
  const margin = opt.margin ?? 0;
  validNumber("Margine pagina", margin, 0, 72);
  if (width <= 2 * margin || height <= 2 * margin) throw new Error("INVALID_INPUT: Margine non lascia spazio visibile");
  return { insets: [0, 0, 0, 0] as const, target: [width, height] as const, fit, margin };
}

export function planPdfCropNormalize(source: Uint8Array, opt: PdfCropNormalizeOptions): PdfCropNormalizePlan {
  if (!(source instanceof Uint8Array) || source.byteLength < 8 || source.byteLength > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: File PDF fuori limite");
  const document = parsePdf(source);
  if (document.encrypted || document.pages.length === 0) throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato o senza pagine");
  const selectedPages = parsePdfPageSelection(opt.pages, document.pages.length).sort((a, b) => a - b);
  const selected = new Set(selectedPages);
  const options = chosenOptions(opt);
  const plans: PdfPageBoxPlan[] = document.pages.map((page, i) => {
    const { media, crop, rotation, width, height } = sourceBox(document, page);
    if (!selected.has(i + 1)) return { page: i + 1, originalMedia: media, originalCrop: crop, sourceRotation: rotation,
      sourceVisibleWidth: width, sourceVisibleHeight: height, resultMedia: media, resultCrop: crop, resultRotation: rotation,
      displayedWidth: width, displayedHeight: height, scale: 1, displayedOffsetX: 0, displayedOffsetY: 0, transform: null };
    if (opt.mode === "crop") {
      const [left, top, right, bottom] = options.insets;
      if (left + right >= width || top + bottom >= height) throw new Error(`INVALID_INPUT: Crop elimina l'intera area visibile sulla pagina ${i + 1}`);
      const [l, b, r, t] = crop;
      // Insets specified in displayed PDF coordinates (not unrotated media axes).
      const cropped: [number, number, number, number] = rotation === 0 ? [l + left, b + bottom, r - right, t - top]
        : rotation === 90 ? [l + bottom, b + left, r - top, t - right]
          : rotation === 180 ? [l + right, b + top, r - left, t - bottom]
            : [l + top, b + right, r - bottom, t - left];
      return { page: i + 1, originalMedia: media, originalCrop: crop, sourceRotation: rotation,
        sourceVisibleWidth: width, sourceVisibleHeight: height, resultMedia: media, resultCrop: cropped, resultRotation: rotation,
        displayedWidth: width - left - right, displayedHeight: height - top - bottom,
        scale: 1, displayedOffsetX: left, displayedOffsetY: bottom, transform: null };
    }
    const [targetW, targetH] = options.target!;
    const availW = targetW - 2 * options.margin, availH = targetH - 2 * options.margin;
    const containScale = Math.min(availW / width, availH / height);
    if (options.fit === "center" && (width > availW || height > availH)) {
      throw new Error(`INVALID_INPUT: Pagina ${i + 1} troppo grande per centro senza scala; scegliere Contieni`);
    }
    const scale = options.fit === "center" ? 1 : containScale;
    const x = (targetW - width * scale) / 2, y = (targetH - height * scale) / 2;
    return { page: i + 1, originalMedia: media, originalCrop: crop, sourceRotation: rotation,
      sourceVisibleWidth: width, sourceVisibleHeight: height,
      resultMedia: [0, 0, targetW, targetH], resultCrop: [0, 0, targetW, targetH], resultRotation: 0,
      displayedWidth: targetW, displayedHeight: targetH, scale, displayedOffsetX: x, displayedOffsetY: y,
      transform: matrixFor(rotation, crop, scale, x, y) };
  });
  return { mode: opt.mode, pageCount: document.pages.length, selectedPages, pages: plans,
    warning: opt.mode === "crop" ? "CROP_HIDES_NOT_REDACTS" : "NORMALIZE_REFRAMES_ORIGINAL_CONTENT" };
}

function checkPreservation(original: PdfDocumentModel, result: PdfDocumentModel, plan: PdfCropNormalizePlan): void {
  if (result.pages.length !== original.pages.length) throw new Error("PDF_OUTPUT_MISMATCH: Numero pagine cambiato");
  for (let index = 0; index < original.pages.length; index++) {
    const expected = plan.pages[index]!;
    const actual = sourceBox(result, result.pages[index]!);
    if (JSON.stringify(actual.media) !== JSON.stringify(expected.resultMedia) ||
      JSON.stringify(actual.crop) !== JSON.stringify(expected.resultCrop) || actual.rotation !== expected.resultRotation) {
      throw new Error(`PDF_OUTPUT_MISMATCH: Box/Rotate pagina ${index + 1} cambiati`);
    }
    const before = contents(original, original.pages[index]!);
    const after = contents(result, result.pages[index]!);
    const wrapped = expected.transform !== null;
    if (after.length !== before.length + (wrapped ? 2 : 0)) throw new Error(`PDF_OUTPUT_MISMATCH: /Contents pagina ${index + 1} non conservati`);
    before.forEach((ref, i) => {
      const oldStream = resolveReference(original, ref), newStream = resolveReference(result, after[i + (wrapped ? 1 : 0)]);
      if (oldStream?.kind !== "stream" || newStream?.kind !== "stream" || oldStream.bytes.length !== newStream.bytes.length ||
        oldStream.bytes.some((byte, j) => byte !== newStream.bytes[j])) throw new Error(`PDF_OUTPUT_MISMATCH: Stream originali pagina ${index + 1} modificati`);
    });
  }
}

export function cropNormalizePdf(source: Uint8Array, options: PdfCropNormalizeOptions, signal?: AbortSignal): { artifact: PdfArtifact; plan: PdfCropNormalizePlan } {
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  const plan = planPdfCropNormalize(source, options);
  const parsed = parsePdf(source);
  const objects = new Map(parsed.objects);
  let nextId = Math.max(0, ...objects.keys()) + 1;
  const chosen = new Set(plan.selectedPages);
  const pages = parsed.pages.map((node, index): PdfPageNode => {
    if (!chosen.has(index + 1)) return node;
    if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
    const original = node.object.value;
    if (original.kind !== "dict") throw new Error("UNSUPPORTED_CAPABILITY: Pagina non valida");
    const spec = plan.pages[index]!;
    const dict = new Map(original.entries);
    const rectangle = (r: readonly [number, number, number, number]) => pdfArray(r.map(pdfNumber));
    dict.set("MediaBox", rectangle(spec.resultMedia));
    dict.set("CropBox", rectangle(spec.resultCrop));
    dict.set("Rotate", pdfNumber(spec.resultRotation));
    if (spec.transform !== null) {
      const originalContent = contents(parsed, node);
      // Separate, balanced graphics-state wrappers preserve original stream bytes.
      const firstId = nextId++, lastId = nextId++;
      const values = spec.transform.map((v) => Number(v.toFixed(7))).join(" ");
      // Explicitly clip to the *previously visible* CropBox: moving content
      // must never reveal hidden marks outside that box on the new page.
      const [cl, cb, cr, ct] = spec.originalCrop;
      const rectangle = [cl, cb, cr - cl, ct - cb].map((v) => Number(v.toFixed(7))).join(" ");
      objects.set(firstId, { id: firstId, generation: 0,
        value: { kind: "stream", dictionary: { kind: "dict", entries: new Map() }, bytes: new TextEncoder().encode(`q\n${values} cm\n${rectangle} re W n\n`) } });
      objects.set(lastId, { id: lastId, generation: 0,
        value: { kind: "stream", dictionary: { kind: "dict", entries: new Map() }, bytes: new TextEncoder().encode("\nQ\n") } });
      dict.set("Contents", pdfArray([pdfReference(firstId), ...originalContent, pdfReference(lastId)]));
    }
    return { object: { ...node.object, value: { kind: "dict", entries: dict } as PdfDictionary }, inherited: node.inherited };
  });
  const document: PdfDocumentModel = { ...parsed, objects, pages };
  const bytes = buildPdfFromPages(pages.map((page) => ({ page, document })), { flatten: false, compress: false, stripMetadata: false });
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  const verified = parsePdf(bytes);
  checkPreservation(parsed, verified, plan);
  const output = Uint8Array.from(bytes);
  return { artifact: { bytes: output, blob: new Blob([output], { type: "application/pdf" }), mime: "application/pdf",
    filename: options.mode === "crop" ? "pdf-ritagliato-visivamente.pdf" : "pdf-dimensioni-normalizzate.pdf", pageCount: plan.pageCount }, plan };
}
