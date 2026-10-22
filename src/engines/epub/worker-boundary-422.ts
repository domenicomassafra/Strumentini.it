import type { EpubBook422 } from "./reader-422";

export const EPUB_WORKER_TIMEOUT_422 = 15_000;

/** Every consumer, including the tool runtime, crosses this killable boundary. */
export function readEpubInWorker422(file: File, signal?: AbortSignal): Promise<EpubBook422> {
  if (signal?.aborted) return Promise.reject(new DOMException("EPUB_CANCELLED", "AbortError"));
  if (typeof Worker === "undefined") return Promise.reject(new Error("EPUB_WORKER_UNAVAILABLE"));
  let worker: Worker;
  try {
    worker = new Worker(new URL("./reader-worker-422.ts", import.meta.url), { type: "module" });
  } catch {
    return Promise.reject(new Error("EPUB_WORKER_UNAVAILABLE"));
  }
  return new Promise<EpubBook422>((resolve, reject) => {
    let settled = false;
    let deadline: ReturnType<typeof setTimeout>;
    const onAbort = () => finish(new DOMException("EPUB_CANCELLED", "AbortError"));
    const finish = (error: Error | null, book?: EpubBook422): void => {
      if (settled) return;
      settled = true;
      worker.terminate();
      clearTimeout(deadline);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else if (book) resolve(book);
      else reject(new Error("EPUB_INVALID"));
    };
    deadline = setTimeout(() => finish(new Error("EPUB_TIMEOUT")), EPUB_WORKER_TIMEOUT_422);
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<{ ok: boolean; book?: EpubBook422; code?: string }>) => {
      if (event.data.ok && event.data.book) finish(null, event.data.book);
      else finish(new Error(event.data.code ?? "EPUB_INVALID"));
    };
    worker.onerror = () => finish(new Error("EPUB_WORKER_FAILURE"));
    if (signal?.aborted) { onAbort(); return; }
    try { worker.postMessage({ file }); }
    catch { finish(new Error("EPUB_WORKER_FAILURE")); }
  });
}
