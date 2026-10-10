import { detectHeavyJobCapabilities, type HeavyJobCapabilitySnapshot } from "../../runtime/heavy-preflight";
import { IMAGE_OCR_FEASIBILITY, inspectLocalImageOcr } from "./image-feasibility";

/**
 * #246 separate, explicitly EXPERIMENTAL browser execution: no catalog entry
 * and #271 physical iOS/Android promotion gates remain unpassed. No CDN, no
 * server processing, no file upload and no network requests outside /ocr-246/.
 * Files are inspected before dynamically loading ~26 MiB of local model/core.
 */
export const OCR_LOCAL_ASSETS_246 = Object.freeze({
  apiUrl: "/ocr-246/vendor/tesseract.esm.min.js",
  workerUrl: "/ocr-246/vendor/worker.min.js",
  coreUrl: "/ocr-246/core",
  languageUrl: "/ocr-246/lang",
  modelUrl: "/ocr-246/lang/ita.traineddata.gz",
  engine: "tesseract.js@7.0.0",
  language: "ita" as const,
  model: "@tesseract.js-data/ita@1.0.0",
  productionPromotion: IMAGE_OCR_FEASIBILITY.productionPromotion,
});

export interface OcrWorker246 {
  recognize(image: File): Promise<{ data: { text: string; confidence?: number | null } }>;
  terminate(): Promise<unknown>;
}

export interface OcrOptions246 {
  readonly language?: string;
  readonly signal?: AbortSignal;
  /** Job clock includes WASM and traineddata initialisation. */
  readonly timeoutMs?: number;
  readonly onProgress?: (status: string, fraction: number) => void;
  /** Injection strictly for tests; UI never supplies a custom runtime. */
  readonly createWorker?: () => Promise<OcrWorker246>;
  readonly imageDecoder?: (image: File) => Promise<{ width: number; height: number }>;
  readonly capabilities?: HeavyJobCapabilitySnapshot;
}

export interface OcrResult246 {
  readonly language: "ita";
  readonly text: string;
  readonly confidence: number | null;
  readonly confidenceOrigin: "TESSERACT_ENGINE_SCORE_NOT_CALIBRATED";
  readonly onDevice: true;
  readonly image: { readonly name: string; readonly width: number; readonly height: number; readonly bytes: number };
  readonly engine: "tesseract.js@7.0.0";
  readonly source: "UPLOADED_IMAGE_LOCAL_ONLY";
  readonly disclaimer: string;
}

const cancelledError = () => new DOMException("OCR italiano annullato", "AbortError");

async function defaultDecoder(image: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(image);
  try { return { width: bitmap.width, height: bitmap.height }; }
  finally { bitmap.close(); }
}

/** Browser only: local *static* Tesseract ESM entry is not imported into the app's baseline JS. */
async function loadSameOriginWorker246(onProgress?: OcrOptions246["onProgress"]): Promise<OcrWorker246> {
  if (typeof window === "undefined") throw new Error("OCR246_BROWSER_ONLY");
  const url = new URL(OCR_LOCAL_ASSETS_246.apiUrl, window.location.href);
  if (url.origin !== window.location.origin) throw new Error("OCR246_OFFSITE_RUNTIME_REFUSED");
  const library = await import(/* @vite-ignore */ url.href) as {
    default: { createWorker: (lang: string, oem: number, settings: Record<string, unknown>) => Promise<OcrWorker246> };
  };
  if (typeof library.default?.createWorker !== "function") throw new Error("OCR246_DONOR_MODULE_INVALID");
  const local = (path: string) => new URL(path, window.location.href).href;
  return library.default.createWorker("ita", 1, {
    workerPath: local(OCR_LOCAL_ASSETS_246.workerUrl),
    corePath: local(OCR_LOCAL_ASSETS_246.coreUrl),
    langPath: local(OCR_LOCAL_ASSETS_246.languageUrl),
    gzip: true,
    cacheMethod: "none", // no IndexedDB persistence of language blobs
    workerBlobURL: false, // genuine same-origin standalone worker
    logger: (event: { status?: string; progress?: number }) => {
      if (typeof event.status === "string") onProgress?.(event.status, Number(event.progress) || 0);
    },
  });
}

export async function recognizeLocalItalianOcr246(image: File, options: OcrOptions246 = {}): Promise<OcrResult246> {
  if (!(image instanceof File)) throw new TypeError("OCR246_FILE_REQUIRED");
  if (options.signal?.aborted) throw cancelledError();
  const preflight = await inspectLocalImageOcr(
    image, options.language ?? "ita", options.signal, options.capabilities ?? detectHeavyJobCapabilities(),
  );
  // The existing #271 promotion state is intentionally not overwritten. Its
  // SAFE preflight validation is reused only for this isolated local runtime.
  if (preflight.errors.length || preflight.preflight.state !== "supported"
    || preflight.width === null || preflight.height === null) {
    throw new Error(preflight.errors.join("; ") || "OCR246_PREFLIGHT_REFUSED");
  }
  if (options.signal?.aborted) throw cancelledError();
  const decoded = await (options.imageDecoder ?? defaultDecoder)(image);
  if (decoded.width !== preflight.width || decoded.height !== preflight.height) {
    throw new Error("OCR246_DECODE_DIMENSION_MISMATCH");
  }
  if (options.signal?.aborted) throw cancelledError();

  const timeoutMs = options.timeoutMs ?? 90_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error("OCR246_INVALID_TIMEOUT");
  let activeWorker: OcrWorker246 | undefined;
  let cleanupPromise: Promise<unknown> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectStop: ((reason: Error) => void) | undefined;
  let stopped = false;
  const stopWorker = (worker: OcrWorker246) => {
    cleanupPromise ??= Promise.resolve().then(() => worker.terminate());
    return cleanupPromise;
  };
  const stoppedPromise = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
  const stop = (reason: Error) => {
    if (stopped) return;
    stopped = true;
    rejectStop?.(reason);
    if (activeWorker) void stopWorker(activeWorker).catch(() => undefined);
  };
  const abort = () => stop(cancelledError());
  options.signal?.addEventListener("abort", abort, { once: true });
  timer = setTimeout(() => stop(new Error("OCR246_TIMEOUT: no output within the bounded local budget")), timeoutMs);
  try {
    if (options.signal?.aborted) throw cancelledError();
    // If aborted while createWorker is loading, its eventual result is
    // immediately terminated even though it was not ready when abort fired.
    const pendingWorker = (options.createWorker ?? (() => loadSameOriginWorker246(options.onProgress)))();
    void pendingWorker.then((worker) => { if (stopped) void stopWorker(worker).catch(() => undefined); }).catch(() => undefined);
    activeWorker = await Promise.race([pendingWorker, stoppedPromise]);
    if (stopped) throw cancelledError();
    const recognized = await Promise.race([activeWorker.recognize(image), stoppedPromise]);
    if (stopped) throw cancelledError();
    const rawText = recognized.data?.text;
    if (typeof rawText !== "string" || rawText.length > 100_000) throw new Error("OCR246_INVALID_ENGINE_OUTPUT");
    const value = recognized.data.confidence;
    const confidence = typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
      ? value : null;
    return {
      language: "ita", text: rawText.trim(), confidence, onDevice: true,
      confidenceOrigin: "TESSERACT_ENGINE_SCORE_NOT_CALIBRATED",
      image: { name: image.name, width: decoded.width, height: decoded.height, bytes: image.size },
      engine: "tesseract.js@7.0.0", source: "UPLOADED_IMAGE_LOCAL_ONLY",
      disclaimer: "Risultato OCR automatico sperimentale. Punteggio del motore non calibrato; controlla sempre i caratteri. Non prova l'esattezza della scansione.",
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    // Await active worker shutdown; never reuse large WASM/model allocations.
    if (activeWorker) await stopWorker(activeWorker);
  }
}
