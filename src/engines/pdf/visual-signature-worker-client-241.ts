import type { VisualSignature241Options, VisualSignature241Plan } from "./visual-signature-241";

type WorkerSuccess241 = { readonly ok: true; readonly bytes: Uint8Array; readonly plan: VisualSignature241Plan };
type WorkerFailure241 = { readonly ok: false; readonly message: string };

/** A disposable worker prevents PDF rewriting from blocking the cancel button. */
export function writeVisibleSignatureInWorker241(source: Uint8Array, options: VisualSignature241Options, signal: AbortSignal): Promise<WorkerSuccess241> {
  if (signal.aborted) return Promise.reject(new DOMException("Firma grafica annullata", "AbortError"));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./visual-signature-worker-241.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("PDF241_WORKER_UNAVAILABLE: Worker locale non disponibile")); return; }
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => { cleanup(); reject(new DOMException("Firma grafica annullata", "AbortError")); };
    const watchdog = setTimeout(() => {
      cleanup();
      reject(new Error("PDF241_TIMEOUT: elaborazione locale oltre 45 secondi"));
    }, 45_000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(new Error("PDF241_WORKER_UNAVAILABLE: elaborazione locale non riuscita"));
    };
    worker.onmessage = (event: MessageEvent<WorkerSuccess241 | WorkerFailure241>) => {
      if (settled) return;
      const data = event.data;
      cleanup();
      if (data?.ok !== true) { reject(new Error(data?.message ?? "PDF241_OUTPUT_VERIFY: output non verificato")); return; }
      if (!(data.bytes instanceof Uint8Array) || data.plan?.capability !== "VISIBLE_IMAGE_ONLY_NO_CRYPTOGRAPHIC_SIGNATURE") {
        reject(new Error("PDF241_OUTPUT_VERIFY: risposta Worker non valida")); return;
      }
      resolve(data);
    };
    if (signal.aborted) { abort(); return; }
    // Ownership of transferred copies is isolated to the Worker. The original
    // source bytes remain intact for independent reopening and stale-result guards.
    try {
      const sourceCopy = source.slice(), pngCopy = options.png.slice();
      worker.postMessage({ source: sourceCopy, options: { ...options, png: pngCopy } },
        [sourceCopy.buffer as ArrayBuffer, pngCopy.buffer as ArrayBuffer]);
    } catch {
      cleanup();
      reject(new Error("PDF241_WORKER_UNAVAILABLE: trasferimento locale non riuscito"));
    }
  });
}
