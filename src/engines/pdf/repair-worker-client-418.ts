import { repairPdf418, type PdfRepair418Result } from "./repair-418";

const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
type WorkerReply = ({ readonly kind: "STR418_REPAIR_RESULT"; readonly ok: true } & PdfRepair418Result) | {
  readonly kind: "STR418_REPAIR_RESULT";
  readonly ok: false;
  readonly code: string;
  readonly message: string;
};

/** Disposable Worker enforces abort and a hard wall timeout around parsing. */
export function repairPdfInWorker418(source: Uint8Array, signal?: AbortSignal): Promise<PdfRepair418Result> {
  if (signal?.aborted) return Promise.reject(new DOMException("PDF recovery cancelled", "AbortError"));
  if (source.byteLength < 50 || source.byteLength > MAX_BYTES) {
    return Promise.reject(new Error("PDF418_LIMIT: Input outside the 4 MiB safe profile."));
  }
  if (typeof Worker === "undefined") {
    if (typeof window !== "undefined") return Promise.reject(new Error("PDF418_WORKER_UNAVAILABLE"));
    return repairPdf418(source, signal);
  }
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./repair-worker-418.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("PDF418_WORKER_UNAVAILABLE")); return; }
    let settled = false;
    const finish = (failure?: Error, result?: PdfRepair418Result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      if (failure) reject(failure);
      else if (result) resolve(result);
      else reject(new Error("PDF418_WORKER_FAILED"));
    };
    const abort = () => finish(new DOMException("PDF recovery cancelled", "AbortError"));
    const timer = setTimeout(() => finish(new Error("PDF418_TIMEOUT: Recovery exceeded 20 seconds.")), TIMEOUT_MS);
    signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = () => finish(new Error("PDF418_WORKER_FAILED"));
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const result = event.data;
      // pdfjs-dist may exchange unrelated internal Worker messages; never
      // mistake these for an application-level repair result.
      if (!result || result.kind !== "STR418_REPAIR_RESULT") return;
      if (result.ok !== true) {
        const safeCode = typeof result?.code === "string" && /^(?:REFUSED|UNSUPPORTED|LIMIT|CANCELLED|VERIFICATION_FAILED)$/.test(result.code) ? result.code : "WORKER_FAILED";
        finish(new Error("PDF418_" + safeCode + ": PDF recovery cannot be independently verified."));
        return;
      }
      if (!(result.bytes instanceof Uint8Array) || result.bytes.byteLength < 50
          || result.bytes.byteLength > MAX_BYTES || result.pageCount < 1
          || result.pageCount > 40 || result.profile !== "single-classic-xref-pointer-only"
          || !Array.isArray(result.losses) || result.losses.length !== 0) {
        finish(new Error("PDF418_WORKER_INVALID: Invalid or oversized worker response."));
        return;
      }
      finish(undefined, result);
    };
    if (signal?.aborted) { abort(); return; }
    try {
      const copy = source.slice();
      worker.postMessage({ source: copy }, [copy.buffer as ArrayBuffer]);
    } catch {
      finish(new Error("PDF418_WORKER_UNAVAILABLE"));
    }
  });
}
