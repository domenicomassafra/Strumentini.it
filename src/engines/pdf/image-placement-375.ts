import { degrees, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import type { PdfArtifact } from "./types";
import { PDF_LIMITS } from "./types";

export interface PdfImagePlacement375 {
  /** 1-based original page. Bounds relative to the visible, rotated crop box. */
  page: number;
  /** Left and top of the visible page, as fractions from 0 to 1. */
  x: number;
  y: number;
  /** Width of the visible bounding box, 0 to 1. Height retains aspect ratio. */
  width: number;
  /** Clockwise rotation in the page preview. */
  rotation: 0 | 90 | 180 | 270;
}

export interface PdfRasterInfo375 {
  kind: "png" | "jpg";
  width: number;
  height: number;
}

function fail(reason: string): never { throw new Error(reason); }
function abort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Elaborazione PDF annullata", "AbortError");
}
function u32(data: Uint8Array, i: number): number {
  return ((data[i]! * 16777216) + (data[i + 1]! << 16) + (data[i + 2]! << 8) + data[i + 3]!) >>> 0;
}
function ascii(data: Uint8Array, offset: number, count: number): string {
  return String.fromCharCode(...data.subarray(offset, offset + count));
}

/** Header-level refusal before decoding an untrusted raster or allocating a PDF image. */
export function inspectPdfImage375(data: Uint8Array): PdfRasterInfo375 {
  if (!(data instanceof Uint8Array) || data.length < 24 || data.length > PDF_LIMITS.maxImageBytes) {
    return fail("PDF_LIMIT: Immagine vuota o oltre 12 MiB");
  }
  if (data[0] === 137 && ascii(data, 1, 3) === "PNG") {
    if (ascii(data, 12, 4) !== "IHDR") return fail("UNSUPPORTED_PNG: Header PNG incompleto");
    const width = u32(data, 16), height = u32(data, 20);
    const depth = data[24], color = data[25], compression = data[26], filter = data[27], interlace = data[28];
    if (depth !== 8 || ![2, 6].includes(color!) || compression !== 0 || filter !== 0 || interlace !== 0) {
      return fail("UNSUPPORTED_PNG: Solo RGB/RGBA 8 bit non interlacciati, senza profili complessi");
    }
    let i = 8;
    let sawEnd = false;
    while (i + 12 <= data.length) {
      const size = u32(data, i);
      if (size > data.length - i - 12) return fail("UNSUPPORTED_PNG: Chunk danneggiato");
      const kind = ascii(data, i + 4, 4);
      if (["iCCP", "cHRM", "gAMA", "sBIT", "tRNS"].includes(kind)) {
        return fail("UNSUPPORTED_PNG: Profilo o trasparenza non normalizzata");
      }
      if (kind === "IEND") { sawEnd = true; break; }
      i += size + 12;
    }
    if (!sawEnd) return fail("UNSUPPORTED_PNG: Fine file mancante");
    return bounded("png", width, height);
  }
  if (data[0] === 0xff && data[1] === 0xd8) {
    let index = 2, width = 0, height = 0;
    while (index + 3 < data.length) {
      if (data[index] !== 0xff) return fail("UNSUPPORTED_JPEG: Segmento non valido");
      while (data[index] === 0xff) index++;
      const marker = data[index++]!;
      if (marker === 0xda) break;
      if (marker === 0xd9) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (index + 2 > data.length) break;
      const size = data[index]! * 256 + data[index + 1]!;
      if (size < 2 || index + size > data.length) return fail("UNSUPPORTED_JPEG: Segmento incompleto");
      if (marker === 0xe2 && ascii(data, index + 2, 11) === "ICC_PROFILE") {
        return fail("UNSUPPORTED_JPEG: Profilo ICC non supportato");
      }
      if (marker === 0xe1 && ascii(data, index + 2, 4) === "Exif" &&
          !safeJpegExifOrientation375(data, index + 2, size - 2)) {
        return fail("UNSUPPORTED_JPEG: Orientamento EXIF diverso da 1 o dati TIFF invalidi");
      }
      if (marker === 0xc0 || marker === 0xc2) {
        const precision = data[index + 2]!;
        height = data[index + 3]! * 256 + data[index + 4]!;
        width = data[index + 5]! * 256 + data[index + 6]!;
        if (precision !== 8 || data[index + 7] !== 3) {
          return fail("UNSUPPORTED_JPEG: Sono ammessi solo JPEG RGB 8 bit");
        }
      } else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return fail("UNSUPPORTED_JPEG: Encoding JPEG non supportato");
      }
      index += size;
    }
    if (!width || !height) return fail("UNSUPPORTED_JPEG: Dimensioni non riconosciute");
    return bounded("jpg", width, height);
  }
  return fail("UNSUPPORTED_IMAGE: Seleziona PNG RGB/RGBA o JPEG RGB");
}

/** Accept EXIF only when its orientation tag is absent or explicitly 1. */
function safeJpegExifOrientation375(data: Uint8Array, start: number, length: number): boolean {
  if (length < 14 || ascii(data, start, 6) !== "Exif\0\0") return false;
  const base = start + 6;
  const little = ascii(data, base, 2) === "II";
  if (!little && ascii(data, base, 2) !== "MM") return false;
  const end = start + length;
  const u16 = (i: number) => little ? data[i]! + data[i + 1]! * 256 : data[i]! * 256 + data[i + 1]!;
  const u32tiff = (i: number) => little
    ? data[i]! + data[i + 1]! * 256 + data[i + 2]! * 65536 + data[i + 3]! * 16777216
    : u32(data, i);
  if (u16(base + 2) !== 42) return false;
  const ifd = base + u32tiff(base + 4);
  if (ifd < base + 8 || ifd + 2 > end) return false;
  const count = u16(ifd);
  if (count > 256 || ifd + 2 + count * 12 > end) return false;
  for (let index = 0; index < count; index++) {
    const entry = ifd + 2 + index * 12;
    if (u16(entry) === 0x0112) {
      return u16(entry + 2) === 3 && u32tiff(entry + 4) === 1 && u16(entry + 8) === 1;
    }
  }
  return true;
}

function bounded(kind: "png" | "jpg", width: number, height: number): PdfRasterInfo375 {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width * height > PDF_LIMITS.maxImagePixels) return fail("PDF_LIMIT: Immagine oltre 16 megapixel");
  return { kind, width, height };
}

export function pdfImagePlacementBounds375(info: PdfRasterInfo375, cropWidth: number, cropHeight: number,
  pageRotation: number, placement: PdfImagePlacement375): { width: number; height: number } {
  if (![0, 90, 180, 270].includes(pageRotation) || ![0, 90, 180, 270].includes(placement.rotation)) {
    return fail("UNSUPPORTED_ROTATION: Sono ammesse rotazioni a 90 gradi");
  }
  const displayWidth = pageRotation % 180 === 0 ? cropWidth : cropHeight;
  const displayHeight = pageRotation % 180 === 0 ? cropHeight : cropWidth;
  const width = placement.width * displayWidth;
  const aspect = placement.rotation % 180 === 0 ? info.height / info.width : info.width / info.height;
  const height = width * aspect;
  if (![placement.x, placement.y, placement.width, width, height, displayWidth, displayHeight].every(Number.isFinite) ||
    placement.x < 0 || placement.y < 0 || width <= 0 || height <= 0 ||
    placement.x * displayWidth + width > displayWidth + 0.001 ||
    placement.y * displayHeight + height > displayHeight + 0.001) {
    return fail("INVALID_INPUT: L'immagine deve rimanere interamente nella pagina visibile");
  }
  return { width: width / displayWidth, height: height / displayHeight };
}

/** Edit the existing page, never copyPages (#1205 can lose form field references). */
export async function insertPdfImage375(source: Uint8Array, raster: Uint8Array,
  placement: PdfImagePlacement375, filename: string, signal?: AbortSignal): Promise<PdfArtifact> {
  abort(signal);
  if (!(source instanceof Uint8Array) || source.byteLength < 8 || source.byteLength > PDF_LIMITS.maxBytes) {
    return fail("PDF_LIMIT: PDF oltre 25 MiB");
  }
  const info = inspectPdfImage375(raster);
  if (!Number.isInteger(placement.page) || placement.page < 1) return fail("INVALID_INPUT: Pagina non valida");
  // A signed or XFA form cannot safely survive arbitrary pdf-lib serialization.
  const sourceText = new TextDecoder("latin1").decode(source);
  if (/\/ByteRange\b|\/XFA\b/u.test(sourceText)) return fail("UNSUPPORTED_PDF: PDF firmato/XFA, originale conservato");
  const pdf = await PDFDocument.load(source.slice(), { ignoreEncryption: false, updateMetadata: false });
  abort(signal);
  if (pdf.getPageCount() > PDF_LIMITS.maxPages || placement.page > pdf.getPageCount()) {
    return fail("PDF_LIMIT: Numero pagina non valido o oltre 200 pagine");
  }
  const acro = pdf.catalog.lookup(PDFName.of("AcroForm"));
  if (acro instanceof PDFDict && acro.has(PDFName.of("XFA"))) {
    return fail("UNSUPPORTED_PDF: Modulo XFA non supportato; originale conservato");
  }
  const page = pdf.getPage(placement.page - 1);
  const crop = page.getCropBox();
  const pageRotation = ((page.getRotation().angle % 360) + 360) % 360;
  const ratios = pdfImagePlacementBounds375(info, crop.width, crop.height, pageRotation, placement);
  const displayWidth = pageRotation % 180 === 0 ? crop.width : crop.height;
  const displayHeight = pageRotation % 180 === 0 ? crop.height : crop.width;
  const w = ratios.width * displayWidth, h = ratios.height * displayHeight;
  const x = placement.x * displayWidth, y = placement.y * displayHeight;
  const anchor = placement.rotation === 0 ? [x, y + h] :
    placement.rotation === 90 ? [x, y] :
    placement.rotation === 180 ? [x + w, y] : [x + w, y + h];
  const [sx, sy] = anchor;
  const world = pageRotation === 0 ? [crop.x + sx!, crop.y + crop.height - sy!] :
    pageRotation === 90 ? [crop.x + sy!, crop.y + sx!] :
    pageRotation === 180 ? [crop.x + crop.width - sx!, crop.y + sy!] :
    [crop.x + crop.width - sy!, crop.y + crop.height - sx!];
  const image = info.kind === "png" ? await pdf.embedPng(raster.slice()) : await pdf.embedJpg(raster.slice());
  abort(signal);
  if (image.width !== info.width || image.height !== info.height) {
    return fail("UNSUPPORTED_IMAGE: Le dimensioni codificate non coincidono");
  }
  const existingPages = pdf.getPages().map((p) => ({
    annotations: p.node.Annots()?.asArray().map((ref) => ref.toString()) ?? [],
    rotation: p.getRotation().angle,
    crop: p.getCropBox(),
  }));
  const formState = (document: PDFDocument) => document.getForm().getFields().map((field) => ({
    name: field.getName(), value: field.acroField.dict.get(PDFName.of("V"))?.toString() ?? "",
  }));
  const existingFields = formState(pdf);
  const nativeWidth = placement.rotation % 180 === 0 ? w : h;
  const nativeHeight = placement.rotation % 180 === 0 ? h : w;
  page.drawImage(image, { x: world[0]!, y: world[1]!, width: nativeWidth, height: nativeHeight,
    rotate: degrees((pageRotation - placement.rotation + 360) % 360) });
  const bytes = await pdf.save({ useObjectStreams: false, updateFieldAppearances: false });
  abort(signal);
  if (bytes.byteLength > PDF_LIMITS.maxOutputBytes) return fail("PDF_LIMIT: Risultato oltre 50 MiB");
  const reopened = await PDFDocument.load(bytes.slice(), { ignoreEncryption: false, updateMetadata: false });
  if (reopened.getPageCount() !== pdf.getPageCount() ||
      reopened.getPages().some((p, i) => {
        const before = existingPages[i]!;
        return JSON.stringify(p.node.Annots()?.asArray().map((ref) => ref.toString()) ?? []) !==
          JSON.stringify(before.annotations) || p.getRotation().angle !== before.rotation ||
          JSON.stringify(p.getCropBox()) !== JSON.stringify(before.crop);
      }) ||
      JSON.stringify(formState(reopened)) !== JSON.stringify(existingFields)) {
    return fail("PDF_VERIFY: Le annotazioni o i campi non sono conservati");
  }
  abort(signal);
  const outputName = (filename.replace(/\.pdf$/iu, "").slice(0, 110) || "documento") + "-immagine.pdf";
  return { bytes, blob: new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }),
    filename: outputName, mime: "application/pdf", pageCount: reopened.getPageCount() };
}
