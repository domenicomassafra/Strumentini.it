import { IMAGE_VISUAL_LIMITS, ImageVisualError, abortIfNeeded as abortImageIfNeeded, assertPixels } from "../image/visual";
import { makeCanvas, outputBlob, type OutputMime } from "../image/operations";
import { PDF_LIMITS, type PdfArtifact } from "./types";
import { parsePdfPageSelection, strictPdfPageNumbers } from "./page-selection";

export interface PdfPageRenderOptions {
  readonly pages?: readonly number[] | string;
  readonly mime?: OutputMime;
  readonly scale?: number;
  readonly quality?: number;
  /** Flattened raster background, not a change to source PDF transparency. */
  readonly background?: string;
}

export interface PdfPageRenderResult {
  readonly artifacts: readonly PdfArtifact[];
  readonly pageCount: number;
  readonly selectedPages: readonly number[];
  readonly mime: OutputMime;
  readonly scale: number;
  readonly effectiveDpi: number;
  readonly quality: number | null;
  readonly background: string;
  readonly renderer: "pdfjs-local-lazy";
  readonly failures: readonly { readonly page: number; readonly message: string }[];
}

function abortIfNeeded(signal?: AbortSignal): void {
  abortImageIfNeeded(signal);
}

function extensionFor(mime: OutputMime): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

export function normalizePdfRenderOptions(options: PdfPageRenderOptions): { mime: OutputMime; scale: number; quality: number; background: string } {
  const mime = options.mime ?? "image/png";
  if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp") throw new Error("INVALID_INPUT: PDF page output must be JPG, PNG, or WebP.");
  const scale = options.scale ?? 2;
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 4) throw new Error("INVALID_INPUT: PDF render scale must be between 0.5 and 4.");
  const quality = options.quality ?? 0.92;
  if (!Number.isFinite(quality) || quality < 0.1 || quality > 1) throw new Error("INVALID_INPUT: Image quality must be between 0.1 and 1.");
  const background = options.background ?? "#ffffff";
  if (!/^#[0-9a-fA-F]{6}$/u.test(background)) throw new Error("INVALID_INPUT: PDF raster background must be a six-digit hex color.");
  return { mime, scale, quality, background: background.toLowerCase() };
}

export function selectedPdfRasterPages(pageCount: number, pages?: readonly number[] | string): number[] {
  if (pages === undefined) return Array.from({ length: pageCount }, (_, index) => index + 1);
  return typeof pages === "string" ? parsePdfPageSelection(pages, pageCount) : strictPdfPageNumbers(pages, pageCount);
}

async function pdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export async function renderPdfPagesLocal(input: Blob, options: PdfPageRenderOptions = {}, signal?: AbortSignal): Promise<PdfPageRenderResult> {
  if (!(input instanceof Blob) || input.size < 5) throw new Error("INVALID_INPUT: Choose a local PDF file.");
  if (input.size > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: PDF exceeds the local byte limit.");
  abortIfNeeded(signal);
  const bytes = new Uint8Array(await input.arrayBuffer());
  abortIfNeeded(signal);
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") throw new Error("INVALID_PDF_SIGNATURE: File does not start with a PDF signature.");
  const normalized = normalizePdfRenderOptions(options);
  const pdfjs = await pdfJs();
  abortIfNeeded(signal);
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const onAbort = () => loadingTask.destroy();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const pdf = await loadingTask.promise;
    abortIfNeeded(signal);
    if (pdf.numPages < 1 || pdf.numPages > PDF_LIMITS.maxPages) throw new Error("PDF_LIMIT: PDF page count exceeds the local render limit.");
    const pages = selectedPdfRasterPages(pdf.numPages, options.pages);
    const artifacts: PdfArtifact[] = [];
    const failures: Array<{ page: number; message: string }> = [];
    let totalOutput = 0;
    for (const pageNumber of pages) {
      abortIfNeeded(signal);
      try {
        const page = await pdf.getPage(pageNumber);
        try {
          const viewport = page.getViewport({ scale: normalized.scale });
          const width = Math.max(1, Math.ceil(viewport.width));
          const height = Math.max(1, Math.ceil(viewport.height));
          if (width > IMAGE_VISUAL_LIMITS.maxDimension || height > IMAGE_VISUAL_LIMITS.maxDimension) throw new ImageVisualError("PIXEL_LIMIT", `Rendered PDF page ${pageNumber} exceeds the local dimension limit`);
          assertPixels(width, height, `rendered PDF page ${pageNumber}`);
          const canvas = makeCanvas(width, height);
          await page.render({ canvas, viewport, background: normalized.background }).promise;
          abortIfNeeded(signal);
          const blob = await outputBlob(canvas, normalized.mime, normalized.mime === "image/png" ? undefined : normalized.quality, width, height, signal);
          const outBytes = new Uint8Array(await blob.arrayBuffer());
          totalOutput += outBytes.byteLength;
          if (totalOutput > PDF_LIMITS.maxOutputBytes) throw new Error("PDF_LIMIT: Rendered page images exceed the local output byte limit.");
          artifacts.push({
            blob,
            bytes: outBytes,
            filename: `page-${String(pageNumber).padStart(3, "0")}.${extensionFor(normalized.mime)}`,
            mime: normalized.mime,
          });
        } finally {
          page.cleanup();
        }
      } catch (error) {
        abortIfNeeded(signal);
        failures.push({ page: pageNumber, message: error instanceof Error ? error.message : "Page rendering failed." });
      }
    }
    if (artifacts.length === 0) throw new Error(`PDF_RENDER_FAILED: No selected page could be rendered. ${failures.map((failure) => `Page ${failure.page}: ${failure.message}`).join(" ")}`);
    return {
      artifacts,
      pageCount: pdf.numPages,
      selectedPages: pages,
      mime: normalized.mime,
      scale: normalized.scale,
      effectiveDpi: Math.round(72 * normalized.scale),
      quality: normalized.mime === "image/png" ? null : normalized.quality,
      background: normalized.background,
      renderer: "pdfjs-local-lazy",
      failures,
    };
  } catch (error) {
    abortIfNeeded(signal);
    const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name) : "";
    if (name === "PasswordException") throw new Error("UNSUPPORTED_CAPABILITY: Password-protected PDFs must be unlocked with an authorized password before page rendering.");
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await loadingTask.destroy().catch(() => undefined);
  }
}
