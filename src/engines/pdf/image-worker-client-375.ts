import { PDF_LIMITS, type PdfArtifact } from "./types";
import type { PdfImagePlacement375 } from "./image-placement-375";
import InlinePdfImageWorker375 from "./image-worker-375?worker&inline";

type Reply = { kind: "STR375_IMAGE"; ok: true; bytes: Uint8Array; pageCount: number; filename: string }
  | { kind: "STR375_IMAGE"; ok: false; reason: string };
const TIMEOUT_MS = 60_000;

// WebKit can refuse to reopen an already selected File when connectivity changes.
// Cache bounded original bytes for the life of each selected File, and send fresh
// transferable copies so a save never detaches the reusable source.
const localBytes = new WeakMap<File, Promise<Uint8Array>>();
function readLocalFile(file: File): Promise<Uint8Array> {
  const previous = localBytes.get(file);
  if (previous) return previous;
  const bytes = file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  localBytes.set(file, bytes);
  void bytes.catch(() => localBytes.delete(file));
  return bytes;
}


export async function runPdfImageWorker375(source: File, image: File, placement: PdfImagePlacement375,
  signal?: AbortSignal): Promise<PdfArtifact> {
  if (signal?.aborted) throw new DOMException("Annullato", "AbortError");
  if (source.size < 8 || source.size > PDF_LIMITS.maxBytes || image.size < 24 ||
      image.size > PDF_LIMITS.maxImageBytes) throw new Error("PDF_LIMIT: PDF massimo 25 MiB, immagine massimo 12 MiB");
  if (typeof Worker === "undefined") throw new Error("Web Worker non disponibile: nessun PDF generato");
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new InlinePdfImageWorker375(); }
    catch { reject(new Error("Web Worker PDF non disponibile")); return; }
    let settled = false;
    const finish = (error?: Error, artifact?: PdfArtifact) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
      if (error) reject(error);
      else if (artifact) resolve(artifact);
      else reject(new Error("PDF non generato"));
    };
    const cancel = () => finish(new DOMException("Annullato", "AbortError"));
    const timer = setTimeout(() => finish(new Error("PDF_LIMIT: Tempo massimo 60 secondi superato")), TIMEOUT_MS);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onerror = () => finish(new Error("Worker PDF interrotto; originale invariato"));
    worker.onmessage = (event: MessageEvent<Reply>) => {
      const reply = event.data;
      if (!reply || reply.kind !== "STR375_IMAGE") return;
      if (reply.ok === false) { finish(new Error(reply.reason)); return; }
      if (!(reply.bytes instanceof Uint8Array) || reply.bytes.length < 8 ||
          reply.bytes.length > PDF_LIMITS.maxOutputBytes || !Number.isInteger(reply.pageCount) ||
          reply.pageCount < 1 || reply.pageCount > PDF_LIMITS.maxPages ||
          !/^.{1,140}\.pdf$/iu.test(reply.filename)) {
        finish(new Error("PDF_VERIFY: Risultato del worker non valido"));
        return;
      }
      finish(undefined, { bytes: reply.bytes,
        blob: new Blob([Uint8Array.from(reply.bytes)], { type: "application/pdf" }),
        filename: reply.filename, mime: "application/pdf", pageCount: reply.pageCount });
    };
    void Promise.all([readLocalFile(source), readLocalFile(image)]).then(([pdfBytes, rasterBytes]) => {
      if (settled || signal?.aborted) return;
      const pdfCopy = pdfBytes.slice(), rasterCopy = rasterBytes.slice();
      worker.postMessage({ source: pdfCopy, image: rasterCopy,
        placement, filename: source.name }, [pdfCopy.buffer, rasterCopy.buffer]);
    }).catch(() => finish(new Error("Impossibile leggere i file locali")));
  });
}
