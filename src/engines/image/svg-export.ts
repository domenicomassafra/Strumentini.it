import { abortIfNeeded, assertDimension, assertPixels, ImageVisualError, normalizeName } from "./visual";
import { get2d, makeCanvas, outputBlob, validateQuality } from "./operations";

/**
 * SVG is always treated as untrusted XML. This deliberately supports a small,
 * auditable *static* SVG subset: no stylesheet, resources, URI-bearing paint,
 * script, event, animation, foreignObject, filters or implicit CSS inheritance.
 * Never load the original document into the DOM or image decoder.
 */
const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_SVG_BYTES = 1024 * 1024;
const MAX_NODES = 1000;
const MAX_DEPTH = 16;
const ALLOWED_TAGS = new Set([
  "svg", "g", "rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "text", "tspan", "title", "desc",
]);
const NUM = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?";
const NUMBER_RE = new RegExp(`^${NUM}$`, "u");
const NUM_LIST_RE = new RegExp(`^${NUM}(?:[\\s,]+${NUM})*$`, "u");
const COLOR_RE = /^(?:none|transparent|black|white|red|green|blue|yellow|cyan|magenta|gray|grey|orange|purple|#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/u;
const SIMPLE_NUMBERS = new Set(["x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "stroke-width", "font-size", "dx", "dy"]);
const COLORS = new Set(["fill", "stroke"]);
const FRACTIONS = new Set(["opacity", "fill-opacity", "stroke-opacity"]);
const LITERALS: Readonly<Record<string, readonly string[]>> = {
  "stroke-linecap": ["butt", "round", "square"],
  "stroke-linejoin": ["miter", "round", "bevel"],
  "fill-rule": ["nonzero", "evenodd"],
  "text-anchor": ["start", "middle", "end"],
  "font-family": ["Arial", "sans-serif", "serif", "monospace"],
  "font-weight": ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"],
};
const TRANSFORMS = /^(?:\s*(?:translate|scale|rotate|matrix)\(\s*[-+\d.eE,\s]+\)\s*)+$/u;
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/u;
const SAFE_POINTS = /^[\d.eE+,\s-]+$/u;

export type SvgExportMime = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";
export interface SvgExportOptions {
  readonly file: Blob;
  readonly mime: SvgExportMime;
  /** Explicit SVG viewport dimensions *before* scale. */
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  /** Explicit color, or "transparent" for PNG/WebP only. */
  readonly background: string;
  readonly quality?: number;
}

export interface SvgExportOutput {
  readonly blob: Blob;
  readonly filename: string;
  readonly inputMime: "image/svg+xml";
  readonly outputMime: SvgExportMime;
  readonly width: number;
  readonly height: number;
  readonly inputKind: "svg";
  readonly decoder: "browser";
  readonly framePolicy: "single-image";
  readonly lossy: boolean;
  readonly quality: number | null;
  readonly background: string;
  readonly rasterBackedPdf: boolean;
  readonly lossNote: string;
  readonly verification: { readonly signature: true; readonly dimensions: true; readonly decoded: true };
}

function unsafe(message: string): never {
  throw new ImageVisualError("UNSAFE_SVG", message);
}

export function isSvgInput(file: { readonly name?: string; readonly type?: string } | null | undefined): boolean {
  return file != null && (file.type?.toLowerCase() === "image/svg+xml" || /\.svg$/iu.test(file.name ?? ""));
}

export function validateSvgOptions(input: Omit<SvgExportOptions, "file">): { width: number; height: number; background: string; quality: number } {
  if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(input.mime)) {
    throw new ImageVisualError("INVALID_INPUT", "SVG output must be PNG, JPEG, WebP, or raster-backed PDF");
  }
  const width = assertDimension(input.width, "SVG viewport width");
  const height = assertDimension(input.height, "SVG viewport height");
  if (typeof input.scale !== "number" || !Number.isFinite(input.scale) || input.scale < 0.1 || input.scale > 4) {
    throw new ImageVisualError("INVALID_INPUT", "SVG scale must be between 0.1 and 4");
  }
  const outWidth = Math.round(width * input.scale);
  const outHeight = Math.round(height * input.scale);
  assertDimension(outWidth, "SVG output width");
  assertDimension(outHeight, "SVG output height");
  assertPixels(outWidth, outHeight);
  const background = input.background;
  if (!(background === "transparent" && (input.mime === "image/png" || input.mime === "image/webp"))
    && !(typeof background === "string" && /^#[0-9a-fA-F]{6}$/u.test(background))) {
    throw new ImageVisualError("INVALID_INPUT", "Choose a hex RGB background; transparency is only available for PNG/WebP");
  }
  return { width: outWidth, height: outHeight, background, quality: validateQuality(input.quality ?? 0.9) };
}

function allowedAttribute(name: string, value: string, element: string): boolean {
  if (name === "xmlns") return element === "svg" && value === SVG_NS;
  if (SIMPLE_NUMBERS.has(name)) return NUMBER_RE.test(value) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 1_000_000;
  if (COLORS.has(name)) return COLOR_RE.test(value);
  if (FRACTIONS.has(name)) return NUMBER_RE.test(value) && Number(value) >= 0 && Number(value) <= 1;
  if (name === "viewBox") {
    const parts = value.trim().split(/[\s,]+/u);
    return element === "svg" && parts.length === 4 && parts.every((part) => NUMBER_RE.test(part) && Number.isFinite(Number(part)))
      && Number(parts[2]) > 0 && Number(parts[3]) > 0 && parts.every((part) => Math.abs(Number(part)) <= 1_000_000);
  }
  if (name === "preserveAspectRatio") return element === "svg" && /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)$/u.test(value);
  if (name === "points") return SAFE_POINTS.test(value) && NUM_LIST_RE.test(value.trim());
  if (name === "d") return value.length <= 30_000 && PATH_DATA.test(value);
  if (name === "transform") return value.length <= 256 && TRANSFORMS.test(value);
  if (name === "id") return /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/u.test(value);
  return LITERALS[name]?.includes(value) ?? false;
}

/**
 * Validates *every* element/attribute, including nested namespaces, before
 * serialization. DOMParser never injects the input into the live document.
 */
export function sanitizeSvgMarkup(markup: string, width: number, height: number): string {
  if (typeof markup !== "string" || new TextEncoder().encode(markup).byteLength > MAX_SVG_BYTES || markup.trim() === "") unsafe("SVG exceeds local text limit or is empty");
  // No DTD, entities, CSS processing instructions, declaration or comments.
  // XML entities are rejected even if DOMParser would expand them before validation.
  if (/<!|<\?|&(?:#|[a-zA-Z])/u.test(markup)) unsafe("SVG entities, declarations and processing instructions are forbidden");
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    throw new ImageVisualError("UNSUPPORTED_BROWSER", "Safe XML parsing is unavailable");
  }
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  if (parsed.querySelector("parsererror") || parsed.documentElement?.localName !== "svg" || parsed.documentElement.namespaceURI !== SVG_NS) unsafe("Expected a well-formed SVG root");
  const root = parsed.documentElement;
  let nodes = 0;
  function visit(node: Node, depth: number): void {
    if (depth > MAX_DEPTH || ++nodes > MAX_NODES) unsafe("SVG nesting or element count exceeds the limit");
    if (node.nodeType === 3) {
      if (!["text", "tspan", "title", "desc"].includes(node.parentElement?.localName ?? "")
        && node.textContent?.trim()) unsafe("Unexpected SVG text node");
      return;
    }
    if (node.nodeType !== 1) unsafe("Unexpected SVG markup node");
    const element = node as Element;
    if (element.namespaceURI !== SVG_NS || !ALLOWED_TAGS.has(element.localName)) unsafe(`SVG element ${element.localName} is not in the safe static subset`);
    if (element.localName === "svg" && element !== root) unsafe("Nested SVG viewports are not supported");
    for (const attr of Array.from(element.attributes)) {
      if (attr.namespaceURI !== null && !(attr.name === "xmlns" && attr.namespaceURI === "http://www.w3.org/2000/xmlns/")) unsafe("SVG namespaced attributes are forbidden");
      if (attr.name === "xmlns" && allowedAttribute(attr.name, attr.value, element.localName)) continue;
      if (/(?:url\s*\(|javascript:|data:|https?:|\\)/iu.test(attr.value) || !allowedAttribute(attr.name, attr.value.trim(), element.localName)) {
        unsafe(`SVG attribute ${attr.name} or its value is not allowed`);
      }
    }
    for (const child of Array.from(element.childNodes)) visit(child, depth + 1);
  }
  visit(root, 0);
  const originalViewBox = root.getAttribute("viewBox");
  const sourceWidth = Number(root.getAttribute("width"));
  const sourceHeight = Number(root.getAttribute("height"));
  if (!originalViewBox) {
    if (!(sourceWidth > 0 && sourceHeight > 0)) unsafe("SVG requires a viewBox or positive intrinsic dimensions");
    root.setAttribute("viewBox", `0 0 ${sourceWidth} ${sourceHeight}`);
  }
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  return new XMLSerializer().serializeToString(root);
}

function jpegPdf(jpeg: Uint8Array, width: number, height: number): Blob {
  // Fixed, auditable PDF 1.4 structure with one JPEG /DCTDecode XObject:
  // the SVG has already been RASTERIZED. No fonts/paths/vector claims.
  const encoder = new TextEncoder();
  const fragments: Uint8Array[] = [];
  let cursor = 0;
  const offsets = [0];
  const append = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    fragments.push(bytes);
    cursor += bytes.byteLength;
  };
  const obj = (id: number, content: string) => {
    offsets.push(cursor);
    append(`${id} 0 obj\n${content}\nendobj\n`);
  };
  append("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets.push(cursor);
  append(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>\nstream\n`);
  append(jpeg);
  append("\nendstream\nendobj\n");
  const graphics = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`;
  offsets.push(cursor);
  append(`5 0 obj\n<< /Length ${encoder.encode(graphics).byteLength} >>\nstream\n${graphics}endstream\nendobj\n`);
  const xrefStart = cursor;
  append("xref\n0 6\n0000000000 65535 f \n");
  for (const offset of offsets.slice(1)) append(`${String(offset).padStart(10, "0")} 00000 n \n`);
  append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return new Blob(fragments.map((fragment) => Uint8Array.from(fragment).buffer), { type: "application/pdf" });
}

export async function exportSvgLocal(input: SvgExportOptions, signal?: AbortSignal): Promise<SvgExportOutput> {
  const { width, height, background, quality } = validateSvgOptions(input);
  if (!(input.file instanceof Blob) || input.file.size < 1 || input.file.size > MAX_SVG_BYTES) unsafe("SVG file size is outside the bounded limit");
  abortIfNeeded(signal);
  const markup = await input.file.text();
  abortIfNeeded(signal);
  const sanitized = sanitizeSvgMarkup(markup, width, height);
  const svgBlob = new Blob([sanitized], { type: "image/svg+xml" });
  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new ImageVisualError("UNSUPPORTED_BROWSER", "Local SVG image decoding is unavailable");
  }
  // Chromium does not consistently support createImageBitmap(svgBlob).
  // The image decoder accepts a sanitized, self-contained blob URL instead.
  const sourceUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  try {
    image.src = sourceUrl;
    try {
      await image.decode();
    } catch {
      throw new ImageVisualError("DECODE_FAILED", "Browser could not rasterize this safe static SVG");
    }
    abortIfNeeded(signal);
    if (image.naturalWidth !== width || image.naturalHeight !== height) unsafe("SVG decoder did not honor explicit pixel dimensions");
    const canvas = makeCanvas(width, height);
    const ctx = get2d(canvas);
    if (background !== "transparent") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(image, 0, 0, width, height);
    abortIfNeeded(signal);
    const pdf = input.mime === "application/pdf";
    const rasterMime = pdf ? "image/jpeg" : input.mime;
    const raster = await outputBlob(canvas, rasterMime, quality, width, height, signal);
    const blob = pdf ? jpegPdf(new Uint8Array(await raster.arrayBuffer()), width, height) : raster;
    abortIfNeeded(signal);
    if (pdf) {
      const pdfBytes = new Uint8Array(await blob.arrayBuffer());
      if (new TextDecoder().decode(pdfBytes.subarray(0, 9)) !== "%PDF-1.4" + "\n"
        || !new TextDecoder().decode(pdfBytes.subarray(-32)).includes("%%EOF")) unsafe("Generated PDF did not pass signature checks");
    }
    const extension = pdf ? "pdf" : input.mime === "image/jpeg" ? "jpg" : input.mime === "image/webp" ? "webp" : "png";
    const name = typeof (input.file as File).name === "string" ? (input.file as File).name : "svg";
    return {
      blob, filename: `${normalizeName(name)}-svg-raster.${extension}`, inputMime: "image/svg+xml",
      outputMime: input.mime, width, height, inputKind: "svg", decoder: "browser",
      framePolicy: "single-image", background, quality: input.mime === "image/png" ? null : quality,
      lossy: input.mime !== "image/png", rasterBackedPdf: pdf,
      lossNote: pdf
        ? "PDF raster-backed: a JPEG image is embedded in one page. SVG paths and text are not preserved as vectors; not raster-to-SVG vectorization."
        : "SVG shapes were rasterized to pixels locally. No vector paths, SVG text or source metadata are preserved in raster exports.",
      verification: { signature: true, dimensions: true, decoded: true },
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
