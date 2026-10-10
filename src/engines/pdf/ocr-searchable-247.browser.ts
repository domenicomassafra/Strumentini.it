import { OCR_LOCAL_ASSETS_246 } from "../ocr/local-italian-246";
import { detectHeavyJobCapabilities, preflightHeavyLocalJob } from "../../runtime/heavy-preflight";
import { addInvisibleOcrLayer247, OCR_247_CONFIDENCE_FLOOR, preflightScannedPdfSource247, type OcrPage247, type OcrWord247 } from "./ocr-searchable-247";

/** #247 experimental limit, not #246/#271 production promotion. */
export const OCR_PDF_LIMITS_247 = {
  maxInputBytes: 8 * 1024 * 1024,
  maxPages: 3,
  maxScannedPages: 2,
  maxPixelsPerPage: 2_000_000,
  maxRenderedPngBytes: 5 * 1024 * 1024,
  maxWordsPerPage: 450,
  minWordConfidence: OCR_247_CONFIDENCE_FLOOR,
  minPageConfidence: 75,
  maxJobMs: 120_000,
  maxDifferentPixelRatio: 0.0005,
  maxChannelDifference: 3,
} as const;

interface TesseractWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
interface TesseractBlock { paragraphs: { lines: { words: TesseractWord[] }[] }[] }
interface TesseractWorker {
  recognize(image: Blob, options: Record<string, never>, output: { text: true; blocks: true }): Promise<{
    data: { text: string; confidence: number; blocks: TesseractBlock[] | null };
  }>;
  terminate(): Promise<unknown>;
}

export interface PdfSearchablePage247 {
  readonly page: number;
  readonly state: "OCR_ADDED" | "DIGITAL_TEXT_PRESERVED";
  readonly text: string;
  readonly wordCount: number;
  readonly confidence: number | null;
  readonly differentPixelsRatio: number;
  readonly maxChannelDifference: number;
}
export interface PdfSearchableResult247 {
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly pages: readonly PdfSearchablePage247[];
  readonly engine: "tesseract.js@7.0.0 + pdfjs-dist@6";
  readonly visualTolerance: { readonly changedPixelRatio: 0.0005; readonly maxChannelDifference: 3 };
}

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("PDF OCR annullato", "AbortError");
}

async function recognizeWords247(image: Blob, signal: AbortSignal | undefined, timeoutMs: number): Promise<{
  text: string; confidence: number | null; words: OcrWord247[];
}> {
  aborted(signal);
  const local = (path: string) => {
    const url = new URL(path, window.location.href);
    if (url.origin !== window.location.origin) throw new Error("OCR247_OFFSITE_ASSET_REFUSED");
    return url.href;
  };
  const cancelError = () => new DOMException("PDF OCR annullato", "AbortError");
  let worker: TesseractWorker | null = null;
  let pending: Promise<TesseractWorker> | null = null;
  let termination: Promise<unknown> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopReason: Error | null = null;
  let stopReject: (error: Error) => void = () => undefined;
  const stopping = new Promise<never>((_resolve, reject) => { stopReject = reject; });
  const stopWorker = (target: TesseractWorker) => {
    termination ??= Promise.resolve().then(() => target.terminate());
    return termination;
  };
  const stop = (error: Error) => {
    if (stopReason) return;
    stopReason = error;
    stopReject(error);
    if (worker) void stopWorker(worker).catch(() => undefined);
  };
  const onAbort = () => stop(cancelError());
  signal?.addEventListener("abort", onAbort, { once: true });
  timer = setTimeout(() => stop(new Error("OCR247_OCR_TIMEOUT")), timeoutMs);
  try {
    const module = await Promise.race([
      import(/* @vite-ignore */ local(OCR_LOCAL_ASSETS_246.apiUrl)), stopping,
    ]) as { default: { createWorker: (language: string, oem: number, options: Record<string, unknown>) => Promise<TesseractWorker> } };
    aborted(signal);
    if (typeof module.default?.createWorker !== "function") throw new Error("OCR247_INVALID_LOCAL_DONOR");
    pending = module.default.createWorker("ita", 1, {
      workerPath: local(OCR_LOCAL_ASSETS_246.workerUrl),
      corePath: local(OCR_LOCAL_ASSETS_246.coreUrl),
      langPath: local(OCR_LOCAL_ASSETS_246.languageUrl),
      gzip: true, cacheMethod: "none", workerBlobURL: false,
    });
    void pending.then((created) => { if (stopReason) void stopWorker(created).catch(() => undefined); }).catch(() => undefined);
    worker = await Promise.race([pending, stopping]);
    if (stopReason) throw stopReason;
    const recognized = await Promise.race([worker.recognize(image, {}, { text: true, blocks: true }), stopping]);
    if (stopReason) throw stopReason;
    const blocks = recognized.data?.blocks;
    if (!Array.isArray(blocks)) throw new Error("OCR247_NO_WORD_COORDINATES: motore non ha restituito bounding box");
    const words = blocks.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)))
      .filter((word) => typeof word.text === "string" && word.text.trim());
    if (!words.length || words.length > OCR_PDF_LIMITS_247.maxWordsPerPage || typeof recognized.data.text !== "string") {
      throw new Error("OCR247_UNRELIABLE_RESULT: numero parole o testo non valido");
    }
    const confidence = recognized.data.confidence;
    if (!Number.isFinite(confidence) || confidence < OCR_PDF_LIMITS_247.minPageConfidence || confidence > 100 ||
      words.some((word) => !Number.isFinite(word.confidence) || word.confidence < OCR_PDF_LIMITS_247.minWordConfidence || word.confidence > 100)) {
      throw new Error("OCR247_LOW_CONFIDENCE: verifica la scansione e migliora la qualità prima di creare testo ricercabile");
    }
    return { text: recognized.data.text.trim(), words: words.map((word) => ({
      text: word.text.trim(), bbox: word.bbox, confidence: word.confidence,
    })), confidence: Number.isFinite(confidence) && confidence >= 0 && confidence <= 100 ? confidence : null };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (timer) clearTimeout(timer);
    if (worker) await stopWorker(worker).catch(() => undefined);
    // A worker resolving after cancellation is terminated by the pending handler.
  }
}

async function renderPixels247(page: import("pdfjs-dist").PDFPageProxy, scale: number, signal?: AbortSignal) {
  aborted(signal);
  const viewport = page.getViewport({ scale });
  const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
  if (width < 1 || height < 1 || width * height > OCR_PDF_LIMITS_247.maxPixelsPerPage) throw new Error("OCR247_PAGE_PIXEL_LIMIT");
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("OCR247_CANVAS_UNAVAILABLE");
  const task = page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" });
  const cancel = () => task.cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    await task.promise;
    aborted(signal);
    return { canvas, pixels: context.getImageData(0, 0, width, height).data, width, height };
  } catch (error) { canvas.width = 0; canvas.height = 0; throw error; }
  finally { signal?.removeEventListener("abort", cancel); }
}

function pixelDifference247(before: Uint8ClampedArray, after: Uint8ClampedArray) {
  if (before.length !== after.length) throw new Error("OCR247_RENDER_DIMENSIONS_CHANGED");
  let changed = 0, maximum = 0;
  for (let index = 0; index < before.length; index += 4) {
    let differing = false;
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs(before[index + channel]! - after[index + channel]!);
      if (delta > 0) differing = true;
      maximum = Math.max(maximum, delta);
    }
    if (differing) changed += 1;
  }
  return { ratio: changed / (before.length / 4), max: maximum };
}

export async function makeSearchableScannedPdf247(input: File, signal?: AbortSignal): Promise<PdfSearchableResult247> {
  if (typeof window === "undefined" || typeof document === "undefined") throw new Error("OCR247_BROWSER_ONLY");
  aborted(signal);
  if (!(input instanceof File) || input.size < 8 || input.size > OCR_PDF_LIMITS_247.maxInputBytes ||
    !input.name.toLowerCase().endsWith(".pdf")) throw new Error("OCR247_INPUT_LIMIT: PDF locale massimo 8 MiB");
  const preflight = preflightHeavyLocalJob({
    capabilities: { worker: "required", wasm: "required", "image-decode": "required" },
    limits: { hardInputBytes: OCR_PDF_LIMITS_247.maxInputBytes },
  }, { inputBytes: input.size }, detectHeavyJobCapabilities());
  if (preflight.state !== "supported") throw new Error("OCR247_BROWSER_CAPABILITY_REFUSED: " + preflight.reasons.join("; "));
  const bytes = new Uint8Array(await input.arrayBuffer());
  aborted(signal);
  if (new TextDecoder("latin1").decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("OCR247_INVALID_SIGNATURE");
  preflightScannedPdfSource247(bytes);
  const [{ default: workerUrl }, pdfjs] = await Promise.all([
    import("pdfjs-dist/build/pdf.worker.mjs?url"), import("pdfjs-dist"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const originalTask = pdfjs.getDocument({ data: bytes.slice(), disableAutoFetch: true, disableStream: true });
  const cancelOriginal = () => originalTask.destroy();
  signal?.addEventListener("abort", cancelOriginal, { once: true });
  try {
    const original = await originalTask.promise;
    aborted(signal);
    if (original.numPages < 1 || original.numPages > OCR_PDF_LIMITS_247.maxPages) throw new Error("OCR247_PAGE_LIMIT: massimo 3 pagine");
    const scanned: OcrPage247[] = [];
    // Keep only geometry after OCR: holding 3 RGBA pages while Tesseract loads
    // retains up to 24 MiB unnecessarily. Re-render source on demand for QA.
    const originals: { width: number; height: number; text: string; scale: number }[] = [];
    const states: PdfSearchablePage247[] = [];
    for (let pageNumber = 1; pageNumber <= original.numPages; pageNumber += 1) {
      aborted(signal);
      const page = await original.getPage(pageNumber);
      try {
        const contents = await page.getTextContent();
        const existing = contents.items.map((item) => "str" in item ? item.str : "").join(" ").trim();
        const plain = page.getViewport({ scale: 1 });
        const scale = Math.min(2, Math.sqrt(OCR_PDF_LIMITS_247.maxPixelsPerPage / (Math.ceil(plain.width) * Math.ceil(plain.height))));
        const rendered = await renderPixels247(page, scale, signal);
        try {
          originals.push({ width: rendered.width, height: rendered.height, text: existing, scale });
          if (existing) {
            states.push({ page: pageNumber, state: "DIGITAL_TEXT_PRESERVED", text: existing, confidence: null,
              wordCount: 0, differentPixelsRatio: 0, maxChannelDifference: 0 });
          } else {
            if (scanned.length >= OCR_PDF_LIMITS_247.maxScannedPages) throw new Error("OCR247_SCAN_LIMIT: massimo 2 pagine scansite");
            const png = await new Promise<Blob>((resolve, reject) => rendered.canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("OCR247_PNG_ENCODING_FAILED")), "image/png"));
            if (png.size < 33 || png.size > OCR_PDF_LIMITS_247.maxRenderedPngBytes) throw new Error("OCR247_RENDERED_PNG_LIMIT");
            const result = await recognizeWords247(png, signal, OCR_PDF_LIMITS_247.maxJobMs);
            scanned.push({ page: pageNumber, imageWidth: rendered.width, imageHeight: rendered.height, words: result.words });
            states.push({ page: pageNumber, state: "OCR_ADDED", text: result.text, confidence: result.confidence,
              wordCount: result.words.length, differentPixelsRatio: 0, maxChannelDifference: 0 });
          }
        } finally { rendered.canvas.width = 0; rendered.canvas.height = 0; }
      } finally { page.cleanup(); }
    }
    if (!scanned.length) throw new Error("OCR247_ALREADY_SEARCHABLE: tutte le pagine contengono già testo selezionabile");
    const output = addInvisibleOcrLayer247(bytes, scanned, signal);
    aborted(signal);
    const task = pdfjs.getDocument({ data: output.slice(), disableAutoFetch: true, disableStream: true });
    const cancelOutput = () => task.destroy();
    signal?.addEventListener("abort", cancelOutput, { once: true });
    try {
      const pdf = await task.promise;
      if (pdf.numPages !== original.numPages) throw new Error("OCR247_REOPEN_PAGE_COUNT_CHANGED");
      const verified: PdfSearchablePage247[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        aborted(signal);
        const page = await pdf.getPage(pageNumber);
        const items = await page.getTextContent();
        const after = items.items.map((item) => "str" in item ? item.str : "").join(" ");
        const state = states[pageNumber - 1]!;
        if (state.state === "OCR_ADDED") {
          const words = scanned.find((p) => p.page === pageNumber)!.words;
          if (words.some((word) => !after.includes(word.text))) throw new Error(`OCR247_TEXT_REOPEN_FAILED: pagina ${pageNumber}`);
        } else if (after.trim().replace(/\s+/gu, " ") !== state.text.replace(/\s+/gu, " ")) {
          throw new Error(`OCR247_EXISTING_DIGITAL_TEXT_CHANGED: pagina ${pageNumber}`);
        }
        const base = originals[pageNumber - 1]!;
        const originalPage = await original.getPage(pageNumber);
        try {
          const reference = await renderPixels247(originalPage, base.scale, signal);
          try {
            const next = await renderPixels247(page, base.scale, signal);
            try {
              if (next.width !== base.width || next.height !== base.height || reference.width !== base.width || reference.height !== base.height) {
                throw new Error("OCR247_RENDER_DIMENSIONS_CHANGED");
              }
              const diff = pixelDifference247(reference.pixels, next.pixels);
              if (diff.ratio > OCR_PDF_LIMITS_247.maxDifferentPixelRatio || diff.max > OCR_PDF_LIMITS_247.maxChannelDifference) {
                throw new Error(`OCR247_VISUAL_TOLERANCE_FAILED: pagina ${pageNumber} ratio=${diff.ratio} delta=${diff.max}`);
              }
              verified.push({ ...state, differentPixelsRatio: diff.ratio, maxChannelDifference: diff.max });
            } finally { next.canvas.width = 0; next.canvas.height = 0; }
          } finally { reference.canvas.width = 0; reference.canvas.height = 0; }
        } finally { originalPage.cleanup(); page.cleanup(); }
      }
      return { bytes: output, filename: input.name.replace(/\.pdf$/iu, "") + "-ocr-sperimentale.pdf", pages: verified,
        engine: "tesseract.js@7.0.0 + pdfjs-dist@6",
        visualTolerance: { changedPixelRatio: 0.0005, maxChannelDifference: 3 } };
    } finally {
      signal?.removeEventListener("abort", cancelOutput);
      await task.destroy().catch(() => undefined);
    }
  } finally {
    signal?.removeEventListener("abort", cancelOriginal);
    await originalTask.destroy().catch(() => undefined);
  }
}
