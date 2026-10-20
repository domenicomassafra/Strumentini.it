import type { PdfWorkspaceMode372 } from "./workspace-372";
import { PDF_LIMITS, type PdfArtifact } from "./types";

const TIMEOUT_MS = 60_000;
type WorkerReply = { kind: "STR372_WORKSPACE"; ok: true; bytes: Uint8Array; pageCount: number; filename: string }
  | { kind: "STR372_WORKSPACE"; ok: false; reason: string };
const ERROR: Record<string, string> = {
  LIMIT: "PDF troppo grande: massimo 25 MiB in ingresso, 50 MiB in uscita e 200 pagine. L'originale resta invariato.",
  ENCRYPTED: "Il PDF è cifrato o protetto: questo editor non rimuove password. L'originale resta invariato.",
  SELECTION: "Selezione delle pagine incompleta o non valida. Nessun PDF parziale generato.",
  VERIFY: "Il risultato non ha superato la riapertura indipendente. Nessun download disponibile.",
  UNREADABLE: "PDF malformato o non supportato: nessun risultato generato; conserva l'originale.",
};

export function runPdfWorkspaceWorker372(
  source: File, order: readonly number[], selected: readonly number[], mode: PdfWorkspaceMode372,
  signal?: AbortSignal,
): Promise<PdfArtifact> {
  if (signal?.aborted) return Promise.reject(new DOMException("Annullato", "AbortError"));
  if (source.size < 8 || source.size > PDF_LIMITS.maxBytes) return Promise.reject(new Error(ERROR.LIMIT));
  if (typeof Worker === "undefined") return Promise.reject(new Error("Web Worker non disponibile: impossibile eseguire il PDF in sicurezza."));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./workspace-worker-372.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("Web Worker PDF non disponibile.")); return; }
    let settled = false;
    const finish = (error?: Error, artifact?: PdfArtifact) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
      if (error) reject(error);
      else if (artifact) resolve(artifact);
      else reject(new Error("Elaborazione PDF terminata senza risultato."));
    };
    const cancel = () => finish(new DOMException("Annullato", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Timeout PDF: elaborazione oltre 60 secondi; nessun risultato prodotto.")), TIMEOUT_MS);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onerror = () => finish(new Error("Elaborazione PDF interrotta; originale invariato."));
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (!reply || reply.kind !== "STR372_WORKSPACE") return;
      if (reply.ok !== true) {
        finish(new Error(ERROR[reply.reason] ?? ERROR.UNREADABLE));
        return;
      }
      if (!(reply.bytes instanceof Uint8Array) || reply.bytes.byteLength < 8 ||
          reply.bytes.byteLength > PDF_LIMITS.maxOutputBytes || !Number.isInteger(reply.pageCount) ||
          reply.pageCount < 1 || reply.pageCount > PDF_LIMITS.maxPages || !/^.{1,140}\.pdf$/iu.test(reply.filename)) {
        finish(new Error("Il Worker ha restituito un PDF non valido o oltre i limiti."));
        return;
      }
      finish(undefined, {
        bytes: reply.bytes, blob: new Blob([Uint8Array.from(reply.bytes)], { type: "application/pdf" }),
        filename: reply.filename, pageCount: reply.pageCount, mime: "application/pdf",
      });
    };
    void source.arrayBuffer().then((buffer) => {
      if (settled || signal?.aborted) return;
      // Copy transferred to the worker; the File remains owned by the browser.
      worker.postMessage({ source: new Uint8Array(buffer), order: [...order], selected: [...selected], mode, filename: source.name }, [buffer]);
    }).catch(() => finish(new Error("Impossibile leggere il file PDF locale.")));
  });
}
