import { PDF_LIMITS } from "./types";

/** Only this bounded page window may be passed to the thumbnail renderer. */
export const PDF_THUMBNAIL_WINDOW = 4;
export const PDF_THUMBNAIL_MAX_WIDTH = 176;
export const PDF_THUMBNAIL_MAX_HEIGHT = 208;

export function pdfThumbnailWindow(pageCount: number, startPage: number): readonly number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > PDF_LIMITS.maxPages) {
    throw new Error("PDF_LIMIT: Numero di pagine non supportato");
  }
  if (!Number.isInteger(startPage) || startPage < 1 || startPage > pageCount) {
    throw new Error("INVALID_INPUT: Pagina iniziale fuori intervallo");
  }
  return Array.from({ length: Math.min(PDF_THUMBNAIL_WINDOW, pageCount - startPage + 1) }, (_, i) => startPage + i);
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Anteprima annullata", "AbortError");
}

export interface PdfThumbnailSession {
  readonly pageCount: number;
  readonly renderPage: (pageNumber: number, rotation?: 0 | 90 | 180 | 270, signal?: AbortSignal) => Promise<Blob>;
  readonly close: () => Promise<void>;
}

/**
 * PDF.js is imported only on explicit preview activation. At most one page
 * is rendered at a time; the page, canvas and task are cleaned after every
 * render and the document worker is destroyed on close.
 */
export async function openPdfThumbnailSession(file: File, signal?: AbortSignal): Promise<PdfThumbnailSession> {
  if (!(file instanceof File) || file.size < 5 || file.size > PDF_LIMITS.maxBytes) {
    throw new Error("PDF_LIMIT: Seleziona un PDF locale di dimensione supportata");
  }
  abortIfNeeded(signal);
  const bytes = new Uint8Array(await file.arrayBuffer());
  abortIfNeeded(signal);
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error("INVALID_PDF_SIGNATURE: Il file non è un PDF");
  }
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
  ]);
  abortIfNeeded(signal);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const loading = pdfjs.getDocument({ data: bytes });
  const abortLoading = () => { void loading.destroy(); };
  signal?.addEventListener("abort", abortLoading, { once: true });
  let pdf: Awaited<typeof loading.promise>;
  try {
    pdf = await loading.promise;
    abortIfNeeded(signal);
    pdfThumbnailWindow(pdf.numPages, 1);
  } catch (error) {
    await loading.destroy().catch(() => undefined);
    throw error;
  } finally {
    signal?.removeEventListener("abort", abortLoading);
  }
  let closed = false;
  let active: ReturnType<Awaited<ReturnType<typeof pdf.getPage>>["render"]> | undefined;
  return {
    pageCount: pdf.numPages,
    async renderPage(pageNumber, rotation = 0, renderSignal) {
      if (closed) throw new Error("PDF_PREVIEW_CLOSED: Anteprima già chiusa");
      pdfThumbnailWindow(pdf.numPages, pageNumber);
      if (![0, 90, 180, 270].includes(rotation)) throw new Error("INVALID_INPUT: Rotazione non supportata");
      abortIfNeeded(renderSignal);
      const page = await pdf.getPage(pageNumber);
      let canvas: HTMLCanvasElement | undefined;
      try {
        abortIfNeeded(renderSignal);
        const original = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
        if (original.width <= 0 || original.height <= 0) throw new Error("INVALID_PDF_PAGE: Dimensioni non valide");
        const scale = Math.min(1, PDF_THUMBNAIL_MAX_WIDTH / original.width, PDF_THUMBNAIL_MAX_HEIGHT / original.height);
        const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
        canvas = document.createElement("canvas");
        // Floating-point viewport dimensions can land a fraction above the cap;
        // ceil() alone then emits an extra pixel (177x209), contradicting the
        // published 176x208 limit and defeating bounded pixel comparisons.
        canvas.width = Math.max(1, Math.min(PDF_THUMBNAIL_MAX_WIDTH, Math.ceil(viewport.width)));
        canvas.height = Math.max(1, Math.min(PDF_THUMBNAIL_MAX_HEIGHT, Math.ceil(viewport.height)));
        const ctx = canvas.getContext("2d");
        if (ctx === null) throw new Error("UNSUPPORTED_CANVAS: Il browser non può creare l'anteprima");
        const task = page.render({ canvas, canvasContext: ctx, viewport, background: "rgb(255,255,255)" });
        active = task;
        const abortRender = () => task.cancel();
        renderSignal?.addEventListener("abort", abortRender, { once: true });
        try {
          await task.promise;
          abortIfNeeded(renderSignal);
          const completedCanvas = canvas;
          const blob = await new Promise<Blob>((resolve, reject) => {
            completedCanvas.toBlob((value) => value === null ? reject(new Error("PDF_PREVIEW_ENCODE_FAILED")) : resolve(value), "image/png");
          });
          abortIfNeeded(renderSignal);
          if (blob.type !== "image/png" || blob.size < 1 || blob.size > 1 * 1024 * 1024) {
            throw new Error("PDF_PREVIEW_LIMIT: Anteprima PNG non valida o troppo grande");
          }
          return blob;
        } finally {
          renderSignal?.removeEventListener("abort", abortRender);
          if (active === task) active = undefined;
        }
      } finally {
        if (canvas !== undefined) { canvas.width = 0; canvas.height = 0; }
        page.cleanup();
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      active?.cancel();
      await loading.destroy().catch(() => undefined);
    },
  };
}
