/**
 * #255 PDF pages -> image-only PPTX slides. No editable PDF reconstruction.
 * Reuses the #236 real PDF.js page renderer and fflate (MIT) OOXML ZIP writer.
 * The local blank OOXML seed was created with MIT python-pptx, has no slides,
 * and provides standard PowerPoint masters/theme relationships.
 */
import { unzipSync, zipSync } from "fflate";
import { inspectImageHeader } from "../image/format";
import { exportPdfPageImages236, type PdfImages236Host, type PdfImages236Result } from "./page-images-236";

export const PDF_PPTX_255_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const PDF_PPTX_255_SLIDE_WIDTH_EMU = 9_144_000;
export const PDF_PPTX_255_SLIDE_HEIGHT_EMU = 6_858_000;
export const PDF_PPTX_255_MAX_BYTES = 25 * 1024 * 1024;

export interface PdfPptx255Frame {
  readonly page: number;
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export interface PdfPptx255Result {
  readonly blob: Blob;
  readonly bytes: Uint8Array;
  readonly selectedPages: readonly number[];
  readonly slideCount: number;
  readonly slides: readonly { page: number; imageWidth: number; imageHeight: number; x: number; y: number; cx: number; cy: number }[];
  readonly filename: "pagine-pdf-come-slide.pptx";
  readonly fidelity: "page-as-slide-raster";
  readonly slideDimensionsEmu: { readonly width: number; readonly height: number };
}

const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const RELTYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

function requireOriginal(entries: Record<string, Uint8Array>, name: string): string {
  const data = entries[name];
  if (data === undefined) throw new Error(`PDF_PPTX_255_TEMPLATE: Required OOXML part missing: ${name}`);
  return decoder.decode(data);
}

function beforeEnd(xml: string, closing: string, fragment: string): string {
  if (!xml.includes(closing)) throw new Error(`PDF_PPTX_255_TEMPLATE: Expected ${closing}`);
  return xml.replace(closing, `${fragment}${closing}`);
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Esportazione PPTX annullata", "AbortError");
}

function fittedGeometry(width: number, height: number): { x: number; y: number; cx: number; cy: number } {
  const factor = Math.min(PDF_PPTX_255_SLIDE_WIDTH_EMU / width, PDF_PPTX_255_SLIDE_HEIGHT_EMU / height);
  const cx = Math.round(width * factor);
  const cy = Math.round(height * factor);
  return {
    x: Math.floor((PDF_PPTX_255_SLIDE_WIDTH_EMU - cx) / 2),
    y: Math.floor((PDF_PPTX_255_SLIDE_HEIGHT_EMU - cy) / 2),
    cx, cy,
  };
}

function slideXml(page: number, position: { x: number; y: number; cx: number; cy: number }): string {
  const { x, y, cx, cy } = position;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:pic><p:nvPicPr><p:cNvPr id="2" name="Pagina PDF ${page} (immagine)"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

/**
 * Generates an independent OOXML PPTX package from already encoded, verified
 * page raster images. Every selected page MUST appear exactly once; otherwise
 * refuses the entire deck (never emits a partially successful PowerPoint).
 */
export function buildPdfPptx255(frames: readonly PdfPptx255Frame[], template: Uint8Array, signal?: AbortSignal): PdfPptx255Result {
  if (frames.length < 1 || frames.length > 8) throw new Error("PDF_PPTX_255_PAGE_LIMIT: Seleziona da 1 a 8 pagine.");
  checkAbort(signal);
  const entries = unzipSync(template);
  if (Object.keys(entries).some((path) => /^ppt\/slides\/slide\d+\.xml$/u.test(path))) {
    throw new Error("PDF_PPTX_255_TEMPLATE: La base deve essere senza slide.");
  }
  const slides: Array<{ page: number; imageWidth: number; imageHeight: number; x: number; y: number; cx: number; cy: number }> = [];
  let list = "";
  let rels = "";
  let overrides = '<Default Extension="png" ContentType="image/png"/>';

  for (const [i, frame] of frames.entries()) {
    checkAbort(signal);
    if (!Number.isSafeInteger(frame.page) || frame.page < 1) throw new Error("PDF_PPTX_255_INVALID_PAGE: Numero pagina non valido.");
    const header = inspectImageHeader(frame.bytes);
    if (header.mime !== "image/png" || header.width !== frame.width || header.height !== frame.height) {
      throw new Error("PDF_PPTX_255_BAD_PNG: L'immagine renderizzata non ha i pixel dichiarati.");
    }
    const geometry = fittedGeometry(header.width, header.height);
    const number = i + 1;
    slides.push({ page: frame.page, imageWidth: header.width, imageHeight: header.height, ...geometry });
    entries[`ppt/media/pdf-page-${number}.png`] = new Uint8Array(frame.bytes);
    entries[`ppt/slides/slide${number}.xml`] = encoder.encode(slideXml(frame.page, geometry));
    entries[`ppt/slides/_rels/slide${number}.xml.rels`] = encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${RELTYPE}/slideLayout" Target="../slideLayouts/slideLayout7.xml"/><Relationship Id="rId2" Type="${RELTYPE}/image" Target="../media/pdf-page-${number}.png"/></Relationships>`);
    const relationId = number + 6;
    list += `<p:sldId id="${255 + number}" r:id="rId${relationId}"/>`;
    rels += `<Relationship Id="rId${relationId}" Type="${RELTYPE}/slide" Target="slides/slide${number}.xml"/>`;
    overrides += `<Override PartName="/ppt/slides/slide${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }

  const presentation = requireOriginal(entries, "ppt/presentation.xml");
  // The seed's empty presentation has no slide ID list. Slide order here is
  // the exact user selection order, independently of source page numbering.
  if (presentation.includes("<p:sldIdLst")) throw new Error("PDF_PPTX_255_TEMPLATE: La base deve essere senza elenco slide.");
  entries["ppt/presentation.xml"] = encoder.encode(presentation.replace("<p:sldSz ", `<p:sldIdLst>${list}</p:sldIdLst><p:sldSz `));
  if (!decoder.decode(entries["ppt/presentation.xml"]).includes("<p:sldIdLst>")) throw new Error("PDF_PPTX_255_TEMPLATE: Missing slide list.");
  entries["ppt/_rels/presentation.xml.rels"] = encoder.encode(beforeEnd(requireOriginal(entries, "ppt/_rels/presentation.xml.rels"), "</Relationships>", rels));
  entries["[Content_Types].xml"] = encoder.encode(beforeEnd(requireOriginal(entries, "[Content_Types].xml"), "</Types>", overrides));
  checkAbort(signal);
  const bytes = zipSync(entries, { level: 0 });
  if (bytes.length > PDF_PPTX_255_MAX_BYTES) throw new Error("PDF_PPTX_255_OUTPUT_LIMIT: La presentazione supera 25 MiB.");
  checkAbort(signal);
  const verified = unzipSync(bytes);
  if (Object.keys(verified).filter(path => /^ppt\/slides\/slide\d+\.xml$/u.test(path)).length !== frames.length) {
    throw new Error("PDF_PPTX_255_VERIFY: Numero slide diverso dalle pagine selezionate.");
  }
  for (const [i, frame] of frames.entries()) {
    const image = verified[`ppt/media/pdf-page-${i + 1}.png`];
    if (!image || image.length !== frame.bytes.length || image.some((n, j) => n !== frame.bytes[j])) {
      throw new Error("PDF_PPTX_255_VERIFY: Dati della pagina raster non conservati.");
    }
  }
  return {
    blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: PDF_PPTX_255_MIME }),
    bytes,
    selectedPages: frames.map(frame => frame.page),
    slideCount: frames.length,
    slides,
    filename: "pagine-pdf-come-slide.pptx",
    fidelity: "page-as-slide-raster",
    slideDimensionsEmu: { width: PDF_PPTX_255_SLIDE_WIDTH_EMU, height: PDF_PPTX_255_SLIDE_HEIGHT_EMU },
  };
}

export async function pdfToPptx255(input: Blob, options: { readonly pages?: string; readonly scale?: number } = {},
  signal?: AbortSignal, renderer?: PdfImages236Host, templateBytes?: Uint8Array): Promise<PdfPptx255Result> {
  checkAbort(signal);
  const rendered: PdfImages236Result = await exportPdfPageImages236(input, {
    ...(options.pages?.trim() ? { pages: options.pages } : {}),
    mime: "image/png", scale: options.scale ?? 1.5, background: "#ffffff", zip: false,
  }, signal, renderer);
  if (rendered.failures.length || rendered.files.length !== rendered.selectedPages.length) {
    throw new Error("PDF_PPTX_255_INCOMPLETE: Una o più pagine non sono state renderizzate; nessuna presentazione parziale.");
  }
  checkAbort(signal);
  let template = templateBytes;
  if (!template) {
    // Only fetched after a real user-initiated conversion. Static same-origin
    // template contains zero user content and carries an MIT donor provenance.
    const templateUrl = (await import("./pptx-255-blank.pptx?url")).default;
    const response = await fetch(templateUrl, signal ? { signal } : {});
    if (!response.ok) throw new Error("PDF_PPTX_255_TEMPLATE: Base PowerPoint locale non disponibile.");
    template = new Uint8Array(await response.arrayBuffer());
  }
  return buildPdfPptx255(rendered.files.map(file => ({ page: file.page, bytes: file.bytes, width: file.width, height: file.height })), template, signal);
}
