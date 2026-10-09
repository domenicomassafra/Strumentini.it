import { unzlibSync, zlibSync } from "fflate";
import { parsePdfPageSelection } from "./page-selection";
import {
  arrayOrNull, dictionaryOrNull, nameValue, numberValue, parsePdf, pdfArray, pdfDict, pdfName,
  pdfNumber, pdfReference, resolveReference,
  type PdfDictionary, type PdfDocumentModel, type PdfPageNode, type PdfStream, type PdfValue,
} from "./parser";
import { buildPdfFromPages } from "./writer";
import { PDF_LIMITS, type PdfArtifact } from "./types";

/** Visible graphic on the PDF page, NEVER an electronic/digital signature or certification. */
export interface VisualSignature241Options {
  readonly png: Uint8Array;
  readonly pages: string;
  /** Bottom-left display-space rect, PDF points within the visible CropBox after /Rotate. */
  readonly rect: readonly [number, number, number, number];
}

export interface VisualSignature241Placement {
  readonly page: number;
  readonly rect: readonly [number, number, number, number];
  readonly pageRotation: 0 | 90 | 180 | 270;
  readonly displaySize: readonly [number, number];
  readonly matrix: readonly [number, number, number, number, number, number];
}

export interface VisualSignature241Plan {
  readonly pageCount: number;
  readonly pages: readonly number[];
  readonly placements: readonly VisualSignature241Placement[];
  readonly image: { readonly width: number; readonly height: number; readonly channels: 3 | 4; readonly hasAlpha: boolean };
  readonly capability: "VISIBLE_IMAGE_ONLY_NO_CRYPTOGRAPHIC_SIGNATURE";
  readonly limitations: "REWRITES_UNSIGNED_SIMPLE_PDF_NO_SIGNATURE_VALIDITY";
}

interface PngRaster241 {
  readonly width: number;
  readonly height: number;
  readonly channels: 3 | 4;
  readonly rgb: Uint8Array;
  readonly alpha: Uint8Array | null;
}

const MAX_PNG_BYTES = 2 * 1024 * 1024;
const MAX_PIXELS = 512 * 512;
const MAX_PLACED_PAGES = 8;
const encoder = new TextEncoder();

function fail(code: string, why: string): never { throw new Error(`${code}: ${why}`); }
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Firma grafica annullata", "AbortError");
}
function u32(bytes: Uint8Array, at: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(at, false);
}

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let pos = start; pos < end; pos++) {
    crc ^= bytes[pos]!;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
}

/** Strict, bounded PNG decoder. Only 8-bit noninterlaced RGB/RGBA, verified CRC and inflate length. */
export function decodeSignaturePng241(png: Uint8Array, signal?: AbortSignal): PngRaster241 {
  checkAbort(signal);
  if (!(png instanceof Uint8Array) || png.length < 57 || png.length > MAX_PNG_BYTES
    || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, at) => png[at] === byte)) {
    fail("PDF241_PNG_UNSUPPORTED", "Firma grafica: PNG RGB/RGBA entro 2 MiB richiesto");
  }
  let offset = 8, width = 0, height = 0, channels: 3 | 4 = 3;
  let header = false, completed = false, seenIdat = false;
  const chunks: Uint8Array[] = [];
  let compressedBytes = 0;
  while (offset < png.length) {
    checkAbort(signal);
    if (offset + 12 > png.length) fail("PDF241_PNG_UNSUPPORTED", "Chunk PNG incompleto");
    const length = u32(png, offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (length > MAX_PNG_BYTES || offset + 12 + length > png.length) fail("PDF241_PNG_UNSUPPORTED", "Chunk PNG fuori limiti");
    const start = offset + 8, end = start + length;
    if (crc32(png, offset + 4, end) !== u32(png, end)) fail("PDF241_PNG_CRC", `CRC chunk ${type} non valido`);
    if (!header && type !== "IHDR") fail("PDF241_PNG_UNSUPPORTED", "IHDR deve essere il primo chunk");
    if (type === "IHDR") {
      if (header || length !== 13) fail("PDF241_PNG_UNSUPPORTED", "Header PNG ripetuto o invalido");
      header = true;
      width = u32(png, start); height = u32(png, start + 4);
      if (width < 1 || height < 1 || width > 1024 || height > 1024 || width * height > MAX_PIXELS
        || png[start + 8] !== 8 || ![2, 6].includes(png[start + 9]!)
        || png[start + 10] !== 0 || png[start + 11] !== 0 || png[start + 12] !== 0) {
        fail("PDF241_PNG_UNSUPPORTED", "Solo PNG 8 bit RGB/RGBA, senza palette, interlacing o profili speciali; 262144 pixel massimo");
      }
      channels = png[start + 9] === 6 ? 4 : 3;
    } else if (type === "IDAT") {
      if (completed) fail("PDF241_PNG_UNSUPPORTED", "IDAT dopo IEND");
      seenIdat = true;
      chunks.push(png.subarray(start, end));
      compressedBytes += length;
      if (compressedBytes > MAX_PNG_BYTES) fail("PDF241_PNG_UNSUPPORTED", "Payload compresso troppo grande");
    } else if (type === "pHYs" && !seenIdat && length === 9) {
      // Physical pixel density is irrelevant to explicit PDF-point /Rect.
      // CRC was checked, and this metadata cannot alter RGB or alpha samples.
    } else if (type === "IEND") {
      if (length !== 0 || !seenIdat || end + 4 !== png.length) fail("PDF241_PNG_UNSUPPORTED", "IEND non valido");
      completed = true;
    } else {
      // Do not silently discard ICC, gamma, animation or transparency/palette
      // semantics: DeviceRGB placement has no color-management equivalent.
      fail("PDF241_PNG_UNSUPPORTED", `Chunk ${type} non autorizzato per la fedeltà RGB/alpha`);
    }
    offset = end + 4;
    if (completed) break;
  }
  if (!completed) fail("PDF241_PNG_UNSUPPORTED", "PNG privo di IEND");
  const packed = new Uint8Array(compressedBytes);
  let cursor = 0;
  for (const chunk of chunks) { packed.set(chunk, cursor); cursor += chunk.length; }
  const stride = width * channels;
  // fflate's `out` allocation bounds decompression even if a tiny IDAT is a
  // decompression bomb. +1 detects an oversized raster rather than truncating
  // to an accepted-looking byte count.
  const expectedLength = height * (stride + 1);
  let decoded: Uint8Array;
  try { decoded = unzlibSync(packed, { out: new Uint8Array(expectedLength + 1) }); }
  catch { fail("PDF241_PNG_UNSUPPORTED", "Deflate PNG non valido"); }
  if (decoded.length !== expectedLength) fail("PDF241_PNG_UNSUPPORTED", "Scanline PNG non coerenti");
  const rows = new Uint8Array(width * height * channels);
  for (let row = 0; row < height; row++) {
    checkAbort(signal);
    const filter = decoded[row * (stride + 1)]!;
    if (filter > 4) fail("PDF241_PNG_UNSUPPORTED", "Filtro PNG sconosciuto");
    for (let col = 0; col < stride; col++) {
      const raw = decoded[row * (stride + 1) + 1 + col]!;
      const at = row * stride + col;
      const left = col < channels ? 0 : rows[at - channels]!;
      const above = row === 0 ? 0 : rows[at - stride]!;
      const upperLeft = row === 0 || col < channels ? 0 : rows[at - stride - channels]!;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3
        ? Math.floor((left + above) / 2) : paeth(left, above, upperLeft);
      rows[at] = (raw + predictor) & 255;
    }
  }
  const rgb = new Uint8Array(width * height * 3);
  const alpha = channels === 4 ? new Uint8Array(width * height) : null;
  for (let i = 0; i < width * height; i++) {
    rgb.set(rows.subarray(i * channels, i * channels + 3), i * 3);
    if (alpha) alpha[i] = rows[i * channels + 3]!;
  }
  return { width, height, channels, rgb, alpha };
}

function protectedPdf241(model: PdfDocumentModel): void {
  if (model.encrypted || model.linearized || model.root === null || model.pages.length < 1 || model.pages.length > 40) {
    fail("PDF241_UNSAFE_SOURCE", "PDF cifrato, linearizzato, senza catalogo o oltre 40 pagine");
  }
  // This engine rewrites the file and deliberately refuses anything that could
  // have a signature, attachment, interactivity or inherited viewer behavior.
  if (/\/(?:ByteRange|DocMDP|FieldMDP|SigFlags|AcroForm|Perms|DSS|VRI|XFA|Encrypt)\b/u.test(model.text)) {
    fail("PDF241_SIGNED_OR_FORM_REFUSED", "PDF firmato, con campi, permessi o certificazione non modificabile");
  }
  const catalog = model.objects.get(model.root.id)?.value;
  if (catalog?.kind !== "dict" || nameValue(catalog.entries.get("Type")) !== "Catalog"
    || [...catalog.entries.keys()].some((key) => !["Type", "Pages"].includes(key))) {
    fail("PDF241_UNSAFE_SOURCE", "Catalogo PDF con caratteristiche non preservabili");
  }
  if (model.trailer.entries.has("Prev") || model.trailer.entries.has("XRefStm")) {
    fail("PDF241_UNSAFE_SOURCE", "Revisioni PDF incrementali non supportate");
  }
  const protectedKeys = new Set([
    "ByteRange", "DocMDP", "FieldMDP", "SigFlags", "AcroForm", "Perms", "DSS", "VRI", "XFA", "Encrypt",
    "JS", "JavaScript", "AA", "OpenAction", "Launch", "EmbeddedFile", "EmbeddedFiles", "URI", "A", "Annots",
  ]);
  const hasProtected = (value: PdfValue, depth = 0): boolean => {
    if (depth > 64) return true;
    if (value.kind === "stream") return hasProtected(value.dictionary, depth + 1);
    if (value.kind === "array") return value.items.some((item) => hasProtected(item, depth + 1));
    if (value.kind !== "dict") return false;
    if (nameValue(value.entries.get("Type")) === "Sig" || nameValue(value.entries.get("FT")) === "Sig") return true;
    return [...value.entries].some(([key, entry]) => protectedKeys.has(key) || hasProtected(entry, depth + 1));
  };
  for (const object of model.objects.values()) {
    if (hasProtected(object.value)) fail("PDF241_SIGNED_OR_FORM_REFUSED", "Oggetto firmato o attivo nel PDF");
  }
  for (const node of model.pages) {
    const dict = node.object.value;
    if (dict.kind !== "dict" || [...dict.entries.keys()].some((key) =>
      !["Type", "Parent", "MediaBox", "CropBox", "Rotate", "UserUnit", "Contents", "Resources"].includes(key))) {
      fail("PDF241_UNSAFE_SOURCE", "Pagina con annotazioni o proprietà non rappresentabili");
    }
  }
}

function pageRect241(model: PdfDocumentModel, node: PdfPageNode): { crop: [number, number, number, number]; rotation: 0 | 90 | 180 | 270; width: number; height: number } {
  const dict = node.object.value;
  if (dict.kind !== "dict") fail("PDF241_UNSAFE_SOURCE", "Pagina senza dizionario");
  const box = (name: "CropBox" | "MediaBox"): [number, number, number, number] => {
    const fallback = name === "CropBox" ? dict.entries.get("CropBox") ?? node.inherited.CropBox ?? dict.entries.get("MediaBox") ?? node.inherited.MediaBox
      : dict.entries.get("MediaBox") ?? node.inherited.MediaBox;
    const numbers = arrayOrNull(model, fallback)?.items.map(numberValue);
    if (numbers?.length !== 4 || numbers.some((value) => value === null || !Number.isFinite(value) || Math.abs(value) > PDF_LIMITS.maxPageDimension)) {
      fail("PDF241_UNSAFE_SOURCE", `${name} assente o non verificabile`);
    }
    const result = numbers as [number, number, number, number];
    if (result[2] <= result[0] || result[3] <= result[1]) fail("PDF241_UNSAFE_SOURCE", `${name} fuori ordine`);
    return result;
  };
  const media = box("MediaBox"), crop = box("CropBox");
  if (crop[0] < media[0] || crop[1] < media[1] || crop[2] > media[2] || crop[3] > media[3]) {
    fail("PDF241_UNSAFE_SOURCE", "CropBox fuori MediaBox");
  }
  const unit = numberValue(resolveReference(model, dict.entries.get("UserUnit")));
  if (unit !== null && unit !== 1) fail("PDF241_UNSAFE_SOURCE", "UserUnit non supportato");
  const angle = numberValue(resolveReference(model, dict.entries.get("Rotate") ?? node.inherited.Rotate)) ?? 0;
  if (!Number.isInteger(angle) || angle % 90 !== 0) fail("PDF241_UNSAFE_SOURCE", "Rotazione pagina non ortogonale");
  const rotation = ((angle % 360) + 360) % 360 as 0 | 90 | 180 | 270;
  const w = crop[2] - crop[0], h = crop[3] - crop[1];
  return { crop, rotation, width: rotation % 180 ? h : w, height: rotation % 180 ? w : h };
}

function contents241(model: PdfDocumentModel, page: PdfPageNode): readonly PdfValue[] {
  const dict = page.object.value;
  if (dict.kind !== "dict") fail("PDF241_UNSAFE_SOURCE", "Pagina non valida");
  const raw = dict.entries.get("Contents");
  if (raw === undefined) return [];
  const value = resolveReference(model, raw);
  if (raw.kind === "ref" && value?.kind === "stream") return [raw];
  if (value?.kind === "array" && value.items.every((item) => item.kind === "ref" && resolveReference(model, item)?.kind === "stream")) return value.items;
  fail("PDF241_UNSAFE_SOURCE", "Stream Contents devono essere riferimenti indiretti");
}

export function planVisualSignature241(source: Uint8Array, options: VisualSignature241Options, signal?: AbortSignal): VisualSignature241Plan {
  checkAbort(signal);
  if (!(source instanceof Uint8Array) || source.length < 8 || source.length > PDF_LIMITS.maxBytes || ![37, 80, 68, 70, 45].every((byte, i) => source[i] === byte)) {
    fail("PDF241_UNSAFE_SOURCE", "Documento PDF non valido o troppo grande");
  }
  const model = parsePdf(source);
  protectedPdf241(model);
  const image = decodeSignaturePng241(options.png, signal);
  const pages = parsePdfPageSelection(options.pages, model.pages.length);
  if (pages.length > MAX_PLACED_PAGES) fail("PDF241_PAGE_LIMIT", "Firma grafica su massimo 8 pagine");
  const rect = options.rect;
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every((value) => Number.isFinite(value) && Math.abs(value) <= PDF_LIMITS.maxPageDimension)
    || rect[2]! - rect[0]! < 2 || rect[3]! - rect[1]! < 2) {
    fail("PDF241_RECT_INVALID", "Rettangolo visivo [x0,y0,x1,y1] non valido");
  }
  const placements = pages.map((page): VisualSignature241Placement => {
    const g = pageRect241(model, model.pages[page - 1]!);
    const [x0, y0, x1, y1] = rect;
    if (x0! < 0 || y0! < 0 || x1! > g.width || y1! > g.height) fail("PDF241_RECT_INVALID", `Rettangolo fuori dal CropBox visualizzato a pagina ${page}`);
    const cropW = g.crop[2] - g.crop[0], cropH = g.crop[3] - g.crop[1];
    const tr: readonly [number, number, number, number, number, number] = g.rotation === 0
      ? [1, 0, 0, 1, g.crop[0], g.crop[1]]
      : g.rotation === 90 ? [0, 1, -1, 0, g.crop[0] + cropW, g.crop[1]]
        : g.rotation === 180 ? [-1, 0, 0, -1, g.crop[0] + cropW, g.crop[1] + cropH]
          : [0, -1, 1, 0, g.crop[0], g.crop[1] + cropH];
    const [a, b, c, d, e, f] = tr;
    const width = x1! - x0!, height = y1! - y0!;
    const matrix: readonly [number, number, number, number, number, number] = [a * width, b * width, c * height, d * height,
      a * x0! + c * y0! + e, b * x0! + d * y0! + f];
    return { page, rect: [x0!, y0!, x1!, y1!] as const, pageRotation: g.rotation, displaySize: [g.width, g.height], matrix };
  });
  return { pageCount: model.pages.length, pages, placements,
    image: { width: image.width, height: image.height, channels: image.channels, hasAlpha: image.alpha !== null },
    capability: "VISIBLE_IMAGE_ONLY_NO_CRYPTOGRAPHIC_SIGNATURE", limitations: "REWRITES_UNSIGNED_SIMPLE_PDF_NO_SIGNATURE_VALIDITY" };
}

function imageXObject241(raster: PngRaster241, maskId: number | null): PdfStream {
  return { kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(raster.width), Height: pdfNumber(raster.height),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
    ...(maskId === null ? {} : { SMask: pdfReference(maskId) }),
  }), bytes: zlibSync(raster.rgb) };
}

function graphicsStream241(value: string): PdfStream { return { kind: "stream", dictionary: pdfDict({}), bytes: encoder.encode(value) }; }

/** Writes image overlays into simple unsigned PDF content. No signature field is created. */
export function placeVisualSignature241(source: Uint8Array, options: VisualSignature241Options, signal?: AbortSignal): {
  readonly artifact: PdfArtifact; readonly plan: VisualSignature241Plan;
} {
  const plan = planVisualSignature241(source, options, signal);
  checkAbort(signal);
  const raster = decodeSignaturePng241(options.png, signal);
  const original = parsePdf(source);
  const objects = new Map(original.objects);
  let nextId = Math.max(...objects.keys()) + 1;
  const maskId = raster.alpha === null ? null : nextId++;
  if (raster.alpha !== null && maskId !== null) {
    objects.set(maskId, { id: maskId, generation: 0, value: { kind: "stream", dictionary: pdfDict({
      Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(raster.width), Height: pdfNumber(raster.height),
      ColorSpace: pdfName("DeviceGray"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
    }), bytes: zlibSync(raster.alpha) } });
  }
  const imageId = nextId++;
  objects.set(imageId, { id: imageId, generation: 0, value: imageXObject241(raster, maskId) });
  const chosen = new Map(plan.placements.map((placement) => [placement.page, placement]));
  const updated = original.pages.map((page, at): PdfPageNode => {
    checkAbort(signal);
    const placement = chosen.get(at + 1);
    if (!placement) return page;
    const dict = page.object.value;
    if (dict.kind !== "dict") fail("PDF241_UNSAFE_SOURCE", "Pagina non valida");
    const inheritedResource = dict.entries.get("Resources") ?? page.inherited.Resources;
    const resources = inheritedResource === undefined ? pdfDict({}) : dictionaryOrNull(original, inheritedResource);
    const xo = resources?.entries.get("XObject") === undefined ? pdfDict({}) : dictionaryOrNull(original, resources.entries.get("XObject"));
    if (resources === null || xo === null || xo.entries.has("VS241Image")) fail("PDF241_UNSAFE_SOURCE", "Risorse immagine PDF conflittuali");
    const nextResources: PdfDictionary = { kind: "dict", entries: new Map([...resources.entries,
      ["XObject", { kind: "dict", entries: new Map([...xo.entries, ["VS241Image", pdfReference(imageId)]]) }],
    ]) };
    const isolationStart = nextId++, isolationEnd = nextId++, overlayId = nextId++;
    // Surround original contents, including all original drawing state, with
    // q...Q. A following q...Q image overlay cannot inherit its transform.
    objects.set(isolationStart, { id: isolationStart, generation: 0, value: graphicsStream241("q\n") });
    objects.set(isolationEnd, { id: isolationEnd, generation: 0, value: graphicsStream241("Q\n") });
    objects.set(overlayId, { id: overlayId, generation: 0,
      value: graphicsStream241(`q\n${placement.matrix.map((number) => Number(number.toFixed(6))).join(" ")} cm\n/VS241Image Do\nQ\n`) });
    const updatedDict: PdfDictionary = { kind: "dict", entries: new Map([...dict.entries,
      ["Resources", nextResources],
      ["Contents", pdfArray([pdfReference(isolationStart), ...contents241(original, page), pdfReference(isolationEnd), pdfReference(overlayId)])],
    ]) };
    return { object: { ...page.object, value: updatedDict }, inherited: page.inherited };
  });
  const amended: PdfDocumentModel = { ...original, objects, pages: updated };
  const output = buildPdfFromPages(updated.map((page) => ({ document: amended, page })), { flatten: false, compress: false, stripMetadata: false });
  checkAbort(signal);
  const reopened = parsePdf(output);
  if (reopened.pages.length !== original.pages.length) fail("PDF241_OUTPUT_VERIFY", "Numero pagine differente");
  for (let index = 0; index < original.pages.length; index++) {
    checkAbort(signal);
    const sourceStreams = contents241(original, original.pages[index]!);
    const resultStreams = contents241(reopened, reopened.pages[index]!);
    const selected = chosen.has(index + 1);
    if (resultStreams.length !== sourceStreams.length + (selected ? 3 : 0)) fail("PDF241_OUTPUT_VERIFY", "Stream pagina modificati");
    for (let at = 0; at < sourceStreams.length; at++) {
      const a = resolveReference(original, sourceStreams[at]);
      const b = resolveReference(reopened, resultStreams[at + (selected ? 1 : 0)]);
      if (a?.kind !== "stream" || b?.kind !== "stream" || a.bytes.length !== b.bytes.length
        || a.bytes.some((byte, offset) => byte !== b.bytes[offset])) fail("PDF241_OUTPUT_VERIFY", "Stream originale alterato");
    }
    const before = pageRect241(original, original.pages[index]!);
    const after = pageRect241(reopened, reopened.pages[index]!);
    if (JSON.stringify(before) !== JSON.stringify(after)) fail("PDF241_OUTPUT_VERIFY", "CropBox/Rotate modificati");
  }
  const result = Uint8Array.from(output);
  return { plan, artifact: { bytes: result, blob: new Blob([result], { type: "application/pdf" }),
    filename: "firma-grafica-visiva-NON-digitale.pdf", mime: "application/pdf", pageCount: reopened.pages.length } };
}
