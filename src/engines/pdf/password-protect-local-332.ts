import { PDF_LIMITS, type PdfArtifact } from "./types";
import { protectPdfBytes332 } from "./password-protect-332";

export async function protectPdfWithPassword332(file: Blob, password: string, signal?: AbortSignal): Promise<PdfArtifact> {
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  if (!(file instanceof Blob) || file.size < 8 || file.size > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: File massimo 25 MiB.");
  if (typeof password !== "string" || password.length < 8 || password.length > 128 || /[\x00-\x1f\x7f]/u.test(password)) {
    throw new Error("PDF_PROTECTION_PASSWORD_INVALID: Inserisci da 8 a 128 caratteri senza caratteri di controllo.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  const produced = typeof Worker === "undefined" ? await protectPdfBytes332(bytes, password) : await new Promise<{
    bytes: Uint8Array; pageCount: number;
  }>((resolve, reject) => {
    const worker = new Worker(new URL("./password-protect-worker-332.ts", import.meta.url), { type: "module" });
    let finished = false;
    const close = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => { close(); reject(new DOMException("Operazione annullata", "AbortError")); };
    const timer = setTimeout(() => { close(); reject(new Error("PDF_LIMIT: Tempo massimo di cifratura superato.")); }, 90_000);
    signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = () => { close(); reject(new Error("PDF_PROTECTION_FAILED: Worker locale non disponibile.")); };
    worker.onmessage = (event: MessageEvent<{ ok: true; bytes: Uint8Array; pageCount: number } | { ok: false; message: string }>) => {
      if (finished) return;
      const data = event.data;
      close();
      if (!data.ok) reject(new Error(data.message));
      else resolve({ bytes: data.bytes, pageCount: data.pageCount });
    };
    if (signal?.aborted) { abort(); return; }
    worker.postMessage({ bytes, password }, [bytes.buffer]);
  });
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
  const copy = Uint8Array.from(produced.bytes);
  return { bytes: copy, blob: new Blob([copy.buffer], { type: "application/pdf" }), filename: "pdf-protetto-aes256.pdf", mime: "application/pdf", pageCount: produced.pageCount };
}
