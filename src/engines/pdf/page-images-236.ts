/**
 * #236 isolated, bounded PDF page -> PNG/JPEG raster exports.
 *
 * This is visual rasterization, never PDF redaction, sanitization or removal of
 * hidden text/metadata from an original PDF. It does not mutate the PDF.
 * Browser PDF.js is loaded lazily; alternate hosts enable independent real
 * PDF.js/node-canvas acceptance without adding packages to production routes.
 */
import { unzipSync, zipSync } from "fflate";
import { inspectImageHeader } from "../image/format";
import { parsePdfPageSelection, strictPdfPageNumbers } from "./page-selection";

export const PDF_IMAGES_236_MAX_INPUT_BYTES = 8 * 1024 * 1024;
export const PDF_IMAGES_236_MAX_PAGES = 8;
export const PDF_IMAGES_236_MAX_PAGE_PIXELS = 2_000_000;
export const PDF_IMAGES_236_MAX_TOTAL_PIXELS = 8_000_000;
export const PDF_IMAGES_236_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
export const PDF_IMAGES_236_MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;

type OutputMime = "image/png" | "image/jpeg";

export interface PdfImages236Options {
  readonly pages?: string | readonly number[];
  readonly mime?: OutputMime;
  readonly scale?: number;
  readonly quality?: number;
  readonly background?: string;
  readonly zip?: boolean;
}

interface Viewport236 {
  readonly width: number;
  readonly height: number;
  readonly nativeViewport: unknown;
}

export interface PdfImages236Page {
  readonly viewport: (scale: number) => Viewport236;
  readonly render: (options: {
    readonly viewport: Viewport236;
    readonly width: number;
    readonly height: number;
    readonly mime: OutputMime;
    readonly quality: number;
    readonly background: string;
  }, signal?: AbortSignal) => Promise<Uint8Array>;
  readonly cleanup: () => void;
}

export interface PdfImages236Document {
  readonly pageCount: number;
  readonly getPage: (pageNumber: number) => Promise<PdfImages236Page>;
  readonly close: () => Promise<void>;
}

/** A renderer host must actually render PDF page graphics; bytes must be encoded. */
export interface PdfImages236Host {
  readonly capability: () => { readonly png: boolean; readonly jpeg: boolean; readonly reason: string };
  readonly open: (data: Uint8Array, signal?: AbortSignal) => Promise<PdfImages236Document>;
}

export interface PdfImages236Item {
  readonly page: number;
  readonly filename: string;
  readonly mime: OutputMime;
  readonly bytes: Uint8Array;
  readonly byteLength: number;
  readonly width: number;
  readonly height: number;
  readonly dpi: number;
}

export interface PdfImages236Result {
  readonly pageCount: number;
  readonly selectedPages: readonly number[];
  readonly files: readonly PdfImages236Item[];
  readonly failures: readonly { readonly page: number; readonly reason: string }[];
  readonly zip: null | { readonly filename: "pdf-pages.zip"; readonly bytes: Uint8Array; readonly entryNames: readonly string[] };
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly totalPixels: number;
  readonly scale: number;
  readonly effectiveDpi: number;
  readonly background: string;
  readonly fidelity: "raster-visual-only";
  readonly caveat: string;
}

function fail(code: string, detail: string): never {
  throw new Error(`PDF_236_${code}: ${detail}`);
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("PDF raster export cancelled", "AbortError");
}

function normalize(options: PdfImages236Options): {
  readonly mime: OutputMime;
  readonly scale: number;
  readonly quality: number;
  readonly background: string;
  readonly zip: boolean;
} {
  const mime = options.mime ?? "image/png";
  const scale = options.scale ?? 1;
  const quality = options.quality ?? 0.85;
  const background = options.background ?? "#ffffff";
  if (mime !== "image/png" && mime !== "image/jpeg") fail("UNSUPPORTED_CODEC", "Only verified PNG/JPEG encoders are allowed");
  if (typeof scale !== "number" || !Number.isFinite(scale) || scale < 0.5 || scale > 2) {
    fail("INVALID_SCALE", "Scale must be finite and between 0.5 and 2");
  }
  if (typeof quality !== "number" || !Number.isFinite(quality) || quality < 0.1 || quality > 1) {
    fail("INVALID_QUALITY", "Quality must be finite and 0.1–1");
  }
  if (typeof background !== "string" || !/^#[a-f\d]{6}$/iu.test(background)) {
    fail("INVALID_BACKGROUND", "Raster background must be #RRGGBB");
  }
  if (options.zip !== undefined && typeof options.zip !== "boolean") fail("INVALID_INPUT", "ZIP option must be boolean");
  return { mime, scale, quality, background: background.toLowerCase(), zip: options.zip !== false };
}

function imageBytesVerified(bytes: Uint8Array, mime: OutputMime, width: number, height: number): void {
  if (!(bytes instanceof Uint8Array) || bytes.length < 32) fail("ENCODE_FAILED", "Empty or invalid encoded raster");
  let decoded: ReturnType<typeof inspectImageHeader>;
  try {
    decoded = inspectImageHeader(bytes);
  } catch {
    fail("ENCODE_FAILED", "Raster output header invalid; browser may have substituted PNG");
  }
  if (decoded.mime !== mime || decoded.width !== width || decoded.height !== height) {
    fail("ENCODE_FAILED", "Actual output MIME or pixel dimensions do not match request");
  }
  if (mime === "image/jpeg" && (bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9)) {
    fail("ENCODE_FAILED", "JPEG lacks the EOI end marker");
  }
  if (mime === "image/png" && ![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) {
    fail("ENCODE_FAILED", "PNG signature invalid");
  }
}

/** Preflight browser-native PNG/JPEG encoding before any PDF pages are loaded. */
export function browserPdfImageCapability236(): { readonly png: boolean; readonly jpeg: boolean; readonly reason: string } {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return { png: false, jpeg: false, reason: "Browser Canvas and local decoded-output verification unavailable" };
  }
  let canvas: HTMLCanvasElement | undefined;
  try {
    canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const available = canvas.getContext("2d") !== null;
    const png = available && canvas.toDataURL("image/png").startsWith("data:image/png");
    const jpeg = available && canvas.toDataURL("image/jpeg").startsWith("data:image/jpeg");
    return { png, jpeg, reason: "Capability is measured in this browser; physical mobile validation is separate" };
  } catch {
    return { png: false, jpeg: false, reason: "Canvas encoder probe failed; no codec is assumed" };
  } finally {
    if (canvas) canvas.width = canvas.height = 0;
  }
}

/** Lazy browser-local PDF.js renderer; page tasks and canvases are released. */
export function createBrowserPdfImageHost236(): PdfImages236Host {
  return {
    capability: browserPdfImageCapability236,
    async open(data, signal) {
      checkAbort(signal);
      const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.mjs?url"),
      ]);
      checkAbort(signal);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const loading = pdfjs.getDocument({ data, disableAutoFetch: true, disableStream: true });
      const abortLoad = () => { void loading.destroy(); };
      signal?.addEventListener("abort", abortLoad, { once: true });
      let doc: Awaited<typeof loading.promise>;
      try {
        doc = await loading.promise;
        checkAbort(signal);
      } catch (error) {
        await loading.destroy().catch(() => undefined);
        checkAbort(signal);
        throw error;
      } finally {
        signal?.removeEventListener("abort", abortLoad);
      }
      let closed = false;
      return {
        pageCount: doc.numPages,
        async getPage(number) {
          if (closed) fail("CLOSED", "PDF document already closed");
          const page = await doc.getPage(number);
          return {
            viewport(scale) {
              const nativeViewport = page.getViewport({ scale });
              return { width: nativeViewport.width, height: nativeViewport.height, nativeViewport };
            },
            async render(config, renderSignal) {
              checkAbort(renderSignal);
              const canvas = document.createElement("canvas");
              canvas.width = config.width;
              canvas.height = config.height;
              const context = canvas.getContext("2d");
              if (context === null) fail("UNSUPPORTED_BROWSER", "2D canvas unavailable");
              const task = page.render({
                canvas, canvasContext: context,
                viewport: config.viewport.nativeViewport as ReturnType<typeof page.getViewport>,
                background: config.background,
              });
              const abortRender = () => task.cancel();
              renderSignal?.addEventListener("abort", abortRender, { once: true });
              try {
                await task.promise;
                checkAbort(renderSignal);
                const blob = await new Promise<Blob>((resolve, reject) => {
                  canvas.toBlob((value) => value === null
                    ? reject(new Error("PDF_236_ENCODE_FAILED: Canvas encode returned null"))
                    : resolve(value), config.mime, config.mime === "image/jpeg" ? config.quality : undefined);
                });
                checkAbort(renderSignal);
                if (blob.type !== config.mime) fail("UNSUPPORTED_CODEC", "Canvas substituted an unrequested MIME");
                const decoded = await createImageBitmap(blob);
                try {
                  if (decoded.width !== config.width || decoded.height !== config.height) {
                    fail("ENCODE_FAILED", "Independent browser image decoder reports wrong dimensions");
                  }
                } finally {
                  decoded.close();
                }
                checkAbort(renderSignal);
                return new Uint8Array(await blob.arrayBuffer());
              } finally {
                renderSignal?.removeEventListener("abort", abortRender);
                canvas.width = canvas.height = 0;
              }
            },
            cleanup() { page.cleanup(); },
          };
        },
        async close() {
          if (closed) return;
          closed = true;
          await loading.destroy().catch(() => undefined);
        },
      };
    },
  };
}

function makeZip236(files: readonly PdfImages236Item[], signal?: AbortSignal): PdfImages236Result["zip"] {
  if (files.length < 2) return null;
  checkAbort(signal);
  const entries: Record<string, Uint8Array> = Object.create(null);
  for (const file of files) {
    if (file.filename in entries) fail("ZIP_DUPLICATE", "Duplicate page filename");
    entries[file.filename] = file.bytes;
  }
  // STORE avoids a second synchronous compression pass on already compressed
  // image bytes; total archive size is strictly bounded before returning.
  const zip = zipSync(entries, { level: 0 });
  checkAbort(signal);
  if (zip.length > PDF_IMAGES_236_MAX_ARCHIVE_BYTES) fail("ZIP_LIMIT", "ZIP exceeds 20 MiB");
  const reopened = unzipSync(zip);
  const entryNames = Object.keys(reopened);
  if (entryNames.join("|") !== files.map((file) => file.filename).join("|")) fail("ZIP_VERIFY", "ZIP entry order or names changed");
  for (const file of files) {
    checkAbort(signal);
    const actual = reopened[file.filename];
    if (!actual || actual.length !== file.bytes.length || actual.some((value, i) => value !== file.bytes[i])) {
      fail("ZIP_VERIFY", "ZIP roundtrip differs from exported image bytes");
    }
  }
  return { filename: "pdf-pages.zip", bytes: zip, entryNames };
}

/**
 * Validates all selected pages first, then renders sequentially. Per-page
 * failure is reported with a partial result; invalid document/selection is
 * refused and never silently converted to a truncated page list.
 */
export async function exportPdfPageImages236(
  input: Blob,
  options: PdfImages236Options = {},
  signal?: AbortSignal,
  host: PdfImages236Host = createBrowserPdfImageHost236(),
): Promise<PdfImages236Result> {
  checkAbort(signal);
  if (!(input instanceof Blob) || input.size < 8 || input.size > PDF_IMAGES_236_MAX_INPUT_BYTES) {
    fail("INPUT_LIMIT", "PDF must be 8 bytes–8 MiB");
  }
  const normalized = normalize(options);
  const capability = host.capability();
  if (!(normalized.mime === "image/png" ? capability.png : capability.jpeg)) {
    fail("UNSUPPORTED_CODEC", `${normalized.mime} not proven by active renderer host: ${capability.reason}`);
  }
  const source = new Uint8Array(await input.arrayBuffer());
  checkAbort(signal);
  if (new TextDecoder("ascii").decode(source.subarray(0, 5)) !== "%PDF-") {
    fail("INVALID_PDF", "PDF signature absent");
  }
  let pdf: PdfImages236Document | undefined;
  try {
    pdf = await host.open(source, signal);
    checkAbort(signal);
    if (!Number.isSafeInteger(pdf.pageCount) || pdf.pageCount < 1 || pdf.pageCount > 200) {
      fail("PAGE_LIMIT", "PDF must have 1–200 pages");
    }
    const selectedPages = options.pages === undefined
      ? Array.from({ length: pdf.pageCount }, (_, i) => i + 1)
      : typeof options.pages === "string"
        ? parsePdfPageSelection(options.pages, pdf.pageCount)
        : strictPdfPageNumbers(options.pages, pdf.pageCount);
    if (selectedPages.length === 0 || selectedPages.length > PDF_IMAGES_236_MAX_PAGES) {
      fail("PAGE_LIMIT", "Select 1–8 pages in one export");
    }
    const files: PdfImages236Item[] = [];
    const failures: Array<{ page: number; reason: string }> = [];
    let outputBytes = 0;
    let totalPixels = 0;
    for (const number of selectedPages) {
      checkAbort(signal);
      let page: PdfImages236Page | undefined;
      try {
        page = await pdf.getPage(number);
        checkAbort(signal);
        const viewport = page.viewport(normalized.scale);
        if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
          fail("PIXEL_LIMIT", "Viewport dimensions are not finite");
        }
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);
        const pixels = width * height;
        if (!Number.isSafeInteger(pixels) || width < 1 || height < 1 || width > 4096 || height > 4096
            || pixels > PDF_IMAGES_236_MAX_PAGE_PIXELS || pixels + totalPixels > PDF_IMAGES_236_MAX_TOTAL_PIXELS) {
          fail("PIXEL_LIMIT", "Selected page exceeds 4096 pixels per side, 2M/page or 8M pixels total");
        }
        checkAbort(signal);
        const bytes = await page.render({
          viewport, width, height, mime: normalized.mime,
          quality: normalized.quality, background: normalized.background,
        }, signal);
        checkAbort(signal);
        imageBytesVerified(bytes, normalized.mime, width, height);
        if (bytes.length + outputBytes > PDF_IMAGES_236_MAX_OUTPUT_BYTES) {
          fail("OUTPUT_LIMIT", "Selected images exceed 16 MiB output budget");
        }
        const filename = `page-${String(number).padStart(3, "0")}.${normalized.mime === "image/png" ? "png" : "jpg"}`;
        files.push({ page: number, filename, mime: normalized.mime, bytes, byteLength: bytes.length,
          width, height, dpi: Math.round(normalized.scale * 72) });
        outputBytes += bytes.length;
        totalPixels += pixels;
      } catch (error) {
        checkAbort(signal);
        failures.push({ page: number, reason: error instanceof Error ? error.message : "Raster page failed" });
      } finally {
        page?.cleanup();
      }
    }
    checkAbort(signal);
    if (files.length === 0) fail("RENDER_FAILED", failures.map((item) => `page ${item.page}: ${item.reason}`).join("; "));
    const zip = normalized.zip ? makeZip236(files, signal) : null;
    return {
      pageCount: pdf.pageCount, selectedPages, files, failures, zip,
      inputBytes: source.length, outputBytes, totalPixels,
      scale: normalized.scale, effectiveDpi: Math.round(72 * normalized.scale),
      background: normalized.background,
      fidelity: "raster-visual-only",
      caveat: "Rasterization is visual only. Original PDF text, metadata, annotations or hidden content are not securely removed or redacted. No vector preservation. No physical mobile acceptance.",
    };
  } finally {
    await pdf?.close();
  }
}
