import { PDF_LIMITS } from "./types";
import type { PdfOriginalTextChange133, PdfOriginalTextResult133 } from "./edit-original-text-133";

type Reply = { kind: "STR133_TEXT"; ok: true; result: PdfOriginalTextResult133 }
  | { kind: "STR133_TEXT"; ok: false; reason: string };

const TIMEOUT_MS = 60_000;

/** Runs the original-text writer off the UI thread; abort terminates the worker. */
export function editPdfOriginalTextInWorker133(
  file: File, change: PdfOriginalTextChange133, signal?: AbortSignal,
): Promise<PdfOriginalTextResult133> {
  if (signal?.aborted) return Promise.reject(new DOMException("Operazione annullata", "AbortError"));
  if (file.size < 8 || file.size > PDF_LIMITS.maxBytes) {
    return Promise.reject(new Error("PDF oltre il limite di 25 MiB o non valido."));
  }
  if (typeof Worker === "undefined") return Promise.reject(new Error("Web Worker PDF non disponibile."));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./edit-original-text-worker-133.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("Impossibile avviare il Web Worker PDF.")); return; }
    let finished = false;
    const finish = (error?: Error, result?: PdfOriginalTextResult133) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error("PDF non generato."));
    };
    const cancel = () => finish(new DOMException("Operazione annullata", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Tempo massimo PDF superato: nessun file generato.")), TIMEOUT_MS);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onerror = () => finish(new Error("Web Worker PDF interrotto; originale invariato."));
    worker.onmessage = (event: MessageEvent<Reply>) => {
      const reply = event.data;
      if (!reply || reply.kind !== "STR133_TEXT") return;
      if (!reply.ok) {
        finish(new Error(reply.reason));
        return;
      }
      const result = reply.result;
      if (!(result?.bytes instanceof Uint8Array) || result.bytes.byteLength < 8 ||
          result.bytes.byteLength > PDF_LIMITS.maxOutputBytes || !Number.isInteger(result.pageCount) ||
          result.pageCount < 1 || result.pageCount > PDF_LIMITS.maxPages ||
          !["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"].includes(result.font) ||
          result.layout !== "COURIER_EQUAL_ADVANCE") {
        finish(new Error("PDF_OUTPUT_MISMATCH: risultato del Worker non valido."));
        return;
      }
      finish(undefined, result);
    };
    void file.arrayBuffer().then((buffer) => {
      if (!finished && !signal?.aborted) {
        worker.postMessage({ source: new Uint8Array(buffer), change }, [buffer]);
      }
    }).catch(() => finish(new Error("Impossibile leggere il file PDF locale.")));
  });
}
