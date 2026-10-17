import { sanitizeSvgMarkup } from "./svg-export";

const MAX_BYTES = 1024 * 1024;
const MAX_DIM = 2048;
const MAX_PIXELS = 1024 * 1024;
const SVG_NS = "http://www.w3.org/2000/svg";

export interface SvgCompressionOptions47 {
  readonly precision: number;
  readonly multipass: boolean;
  readonly signal?: AbortSignal;
}

export interface SvgCompressionResult47 {
  readonly blob: Blob;
  readonly safeOriginalPreview: Blob;
  readonly safeOptimizedPreview: Blob;
  readonly filename: string;
  readonly originalBytes: number;
  readonly outputBytes: number;
  readonly originalGzipBytes: number;
  readonly outputGzipBytes: number;
  readonly keptOriginal: boolean;
  readonly vectorPolicy: "static-safe-subset-only";
  readonly pixelVerification: "exact-rgba-all-pixels";
  readonly precision: number;
  readonly multipass: boolean;
}

function fail(code: string, message: string): never {
  throw new Error(`SVG_47_${code}: ${message}`);
}

function check(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Compressione SVG annullata", "AbortError");
}

function dimensions(xml: string): { width: number; height: number } {
  if (typeof DOMParser !== "function") fail("BROWSER_REQUIRED", "DOMParser non disponibile");
  const document = new DOMParser().parseFromString(xml, "image/svg+xml");
  const root = document.documentElement;
  if (document.querySelector("parsererror") || root?.localName !== "svg" || root.namespaceURI !== SVG_NS) {
    fail("INVALID_XML", "Richiesto un SVG XML valido con namespace SVG");
  }
  const box = root.getAttribute("viewBox")?.trim().split(/[\s,]+/u).map(Number);
  const width = Number(root.getAttribute("width") ?? (box?.length === 4 ? box[2] : NaN));
  const height = Number(root.getAttribute("height") ?? (box?.length === 4 ? box[3] : NaN));
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
    width > MAX_DIM || height > MAX_DIM || width * height > MAX_PIXELS) {
    fail("BOUNDS", "Dimensioni SVG esplicite in px o viewBox, intere, massimo 2048px e 1 megapixel");
  }
  return { width, height };
}

async function pixelBytes(blob: Blob, width: number, height: number, signal?: AbortSignal): Promise<Uint8ClampedArray> {
  check(signal);
  if (typeof Image !== "function" || typeof document === "undefined") fail("BROWSER_REQUIRED", "Canvas/Image locali non disponibili");
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    check(signal);
    if (image.naturalWidth !== width || image.naturalHeight !== height) fail("GEOMETRY", "Dimensioni cambiate dopo ottimizzazione");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) fail("CANVAS", "Canvas 2D non disponibile");
      ctx.drawImage(image, 0, 0, width, height);
      return ctx.getImageData(0, 0, width, height).data;
    } finally { canvas.width = 0; canvas.height = 0; }
  } finally { URL.revokeObjectURL(url); }
}

/** SVGO browser donor; rejects unsafe markup and every visible pixel change. */
export async function compressSvg47(file: File, options: SvgCompressionOptions47): Promise<SvgCompressionResult47> {
  check(options?.signal);
  if (!(file instanceof Blob) || file.size < 1 || file.size > MAX_BYTES ||
    !(file.type === "" || file.type === "image/svg+xml") || !/\.svg$/iu.test(file.name ?? "")) {
    fail("INPUT", "Carica un file SVG statico valido, massimo 1 MiB");
  }
  if (!Number.isInteger(options.precision) || options.precision < 2 || options.precision > 6 || typeof options.multipass !== "boolean") {
    fail("OPTIONS", "Precisione da 2 a 6, multipass esplicito");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  check(options.signal);
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { fail("UTF8", "SVG non codificato in UTF-8 valido"); }
  const { width, height } = dimensions(source);
  const safeSource = sanitizeSvgMarkup(source, width, height);
  const sourcePreview = new Blob([safeSource], { type: "image/svg+xml" });
  check(options.signal);
  // `svgo/browser` is explicitly bundled without Node fs/path APIs. The normal
  // SVG sanitizer re-checks all optimized nodes, namespaces and attributes.
  const { optimize } = await import("svgo/browser");
  const optimized = optimize(safeSource, {
    multipass: options.multipass,
    floatPrecision: options.precision,
    js2svg: { pretty: false },
  }).data;
  check(options.signal);
  const safeOptimized = sanitizeSvgMarkup(optimized, width, height);
  const optimizedPreview = new Blob([safeOptimized], { type: "image/svg+xml" });
  const [originalPixels, optimizedPixels] = await Promise.all([
    pixelBytes(sourcePreview, width, height, options.signal),
    pixelBytes(optimizedPreview, width, height, options.signal),
  ]);
  check(options.signal);
  if (originalPixels.length !== optimizedPixels.length ||
    originalPixels.some((channel, index) => channel !== optimizedPixels[index])) {
    fail("PIXELS_CHANGED", "L'ottimizzazione cambia l'immagine: nessun download SVG alterato");
  }
  const keptOriginal = optimizedPreview.size >= bytes.length;
  const output = keptOriginal ? new Blob([bytes], { type: "image/svg+xml" }) : optimizedPreview;
  const { gzipSync } = await import("fflate");
  check(options.signal);
  const originalGzipBytes = gzipSync(bytes, { level: 9 }).length;
  const outputGzipBytes = gzipSync(new Uint8Array(await output.arrayBuffer()), { level: 9 }).length;
  return {
    blob: output, safeOriginalPreview: sourcePreview, safeOptimizedPreview: optimizedPreview,
    filename: file.name.replace(/\.svg$/iu, "") + "-ottimizzato.svg",
    originalBytes: bytes.length, outputBytes: output.size, originalGzipBytes, outputGzipBytes, keptOriginal,
    vectorPolicy: "static-safe-subset-only", pixelVerification: "exact-rgba-all-pixels",
    precision: options.precision, multipass: options.multipass,
  };
}
