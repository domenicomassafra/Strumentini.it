import type { PdfAnnotation134 } from "./annotations-134";
import { PDF_LIMITS, type PdfArtifact } from "./types";

type Reply = { kind: "STR134_ANNOTATIONS"; ok: true; bytes: Uint8Array; filename: string; pageCount: number }
  | { kind: "STR134_ANNOTATIONS"; ok: false; reason: string };

export function runPdfAnnotationWorker134(file: File, marks: readonly PdfAnnotation134[], signal?: AbortSignal): Promise<PdfArtifact> {
  if (file.size < 8 || file.size > PDF_LIMITS.maxBytes) return Promise.reject(new Error("PDF oltre 25 MiB"));
  if (marks.length < 1 || marks.length > 100) return Promise.reject(new Error("Seleziona da 1 a 100 annotazioni"));
  if (signal?.aborted) return Promise.reject(new DOMException("Annullato", "AbortError"));
  if (typeof Worker === "undefined") return Promise.reject(new Error("Worker PDF non disponibile"));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./annotations-worker-134.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("Worker PDF non avviabile")); return; }
    let settled = false;
    const finish = (reason?: Error, artifact?: PdfArtifact) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
      if (reason) reject(reason);
      else if (artifact) resolve(artifact);
      else reject(new Error("Nessun risultato verificato"));
    };
    const cancel = () => finish(new DOMException("Annullato", "AbortError"));
    const timeout = setTimeout(() => finish(new Error("Timeout annotazioni PDF (60 secondi)")), 60_000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onerror = () => finish(new Error("Worker PDF interrotto; originale invariato"));
    worker.onmessage = (event: MessageEvent<Reply>) => {
      const reply = event.data;
      if (!reply || reply.kind !== "STR134_ANNOTATIONS") return;
      if (!reply.ok) { finish(new Error(reply.reason)); return; }
      if (!(reply.bytes instanceof Uint8Array) || reply.bytes.length < 8 || reply.bytes.length > PDF_LIMITS.maxOutputBytes
        || !Number.isInteger(reply.pageCount) || reply.pageCount < 1 || reply.pageCount > PDF_LIMITS.maxPages
        || !reply.filename.endsWith(".pdf")) {
        finish(new Error("Risultato PDF non valido")); return;
      }
      finish(undefined, {
        bytes: reply.bytes,
        blob: new Blob([Uint8Array.from(reply.bytes)], { type: "application/pdf" }),
        filename: reply.filename, pageCount: reply.pageCount, mime: "application/pdf",
      });
    };
    void file.arrayBuffer().then((buffer) => {
      if (!settled) worker.postMessage({ source: new Uint8Array(buffer), marks: [...marks], filename: file.name }, [buffer]);
    }).catch(() => finish(new Error("Impossibile leggere il PDF locale")));
  });
}
