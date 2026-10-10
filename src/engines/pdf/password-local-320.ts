import type { PdfArtifact } from "./types";
import { PDF_LIMITS } from "./types";
import { unlockPdfBytes320, type UnlockedPdf320 } from "./password-engine-320";

/** Spawns one disposable same-origin Worker, which is terminated on completion/cancel/timeout. */
export async function unlockPdfWithPassword320(file: Blob, password: string, signal?: AbortSignal): Promise<PdfArtifact> {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  if (!(file instanceof Blob) || file.size < 8 || file.size > PDF_LIMITS.maxBytes) {
    throw new Error("PDF_LIMIT: Scegli un PDF fino a 25 MiB.");
  }
  if (typeof password !== "string" || password.length < 1 || password.length > 256 || /[\x00-\x1f\x7f]/u.test(password)) {
    throw new Error("PDF_PASSWORD_REQUIRED: Inserisci una password valida (massimo 256 caratteri).");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  let result: UnlockedPdf320;
  if (typeof Worker === "undefined") {
    // Node test/SSR fallback; browsers always use the Worker to isolate WASM CPU work.
    result = await unlockPdfBytes320(bytes, password);
  } else {
    result = await new Promise<UnlockedPdf320>((resolve, reject) => {
      const worker = new Worker(new URL("./password-worker-320.ts", import.meta.url), { type: "module" });
      let finished = false;
      const cleanup = () => {
        if (finished) return;
        finished = true;
        clearTimeout(watchdog);
        signal?.removeEventListener("abort", abort);
        worker.terminate();
      };
      const abort = () => { cleanup(); reject(new DOMException("Operation cancelled", "AbortError")); };
      const watchdog = setTimeout(() => {
        cleanup();
        reject(new Error("PDF_LIMIT: Tempo massimo di elaborazione locale superato."));
      }, 90_000);
      signal?.addEventListener("abort", abort, { once: true });
      worker.onerror = () => {
        cleanup();
        reject(new Error("UNSUPPORTED_CAPABILITY: Il Worker PDF locale non è disponibile."));
      };
      worker.onmessage = (event: MessageEvent<({ ok: true } & UnlockedPdf320) | { ok: false; message: string }>) => {
        if (finished) return;
        const data = event.data;
        cleanup();
        if (!data.ok) reject(new Error(data.message));
        else resolve({ bytes: data.bytes, pageCount: data.pageCount, encryption: data.encryption });
      };
      if (signal?.aborted) { abort(); return; }
      worker.postMessage({ bytes, password }, [bytes.buffer]);
    });
  }
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  if (result.bytes.byteLength > PDF_LIMITS.maxOutputBytes) throw new Error("PDF_LIMIT: Il risultato supera i limiti locali.");
  const copy = Uint8Array.from(result.bytes);
  return { bytes: copy, blob: new Blob([copy.buffer], { type: "application/pdf" }), filename: "pdf-sbloccato.pdf", mime: "application/pdf", pageCount: result.pageCount };
}
