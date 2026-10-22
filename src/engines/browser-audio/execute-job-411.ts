import type { AudioJob231, AudioJobResult231, AudioPreviewJob036, AudioPreviewResult036 } from "./timeline-worker-231";

const BARS = 192;

/** Owns exactly one disposable Worker and never publishes cancelled output. */
export function executeAudioJob231(
  job: AudioJob231 | AudioPreviewJob036, signal: AbortSignal,
  onRenderFrames?: (completed: number, total: number) => void,
): Promise<AudioJobResult231 | AudioPreviewResult036> {
  if (signal.aborted) return Promise.reject(new DOMException("Montaggio annullato", "AbortError"));
  if (typeof Worker === "undefined") return Promise.reject(new Error("AUDIO_231_WORKER_UNSUPPORTED: Web Worker non disponibile."));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./timeline-worker-231.ts", import.meta.url), { type: "module" }); }
    catch (error) { reject(error); return; }
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error, result?: AudioJobResult231 | AudioPreviewResult036) => {
      if (settled) return;
      settled = true;
      if (watchdog !== undefined) clearTimeout(watchdog);
      signal.removeEventListener("abort", onAbort);
      worker.terminate();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error("AUDIO_231_WORKER_FAILED: Nessun output verificabile."));
    };
    const onAbort = () => finish(new DOMException("Montaggio annullato", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<AudioJobResult231 | AudioPreviewResult036 |
      { kind: "progress"; phase: "output-frames"; completed: number; total: number } | { kind: "error"; message: string }>) => {
      if (settled) return;
      const response = event.data;
      if (response?.kind === "error") { finish(new Error(response.message)); return; }
      if (response?.kind === "progress") {
        if (response.phase !== "output-frames" || !Number.isSafeInteger(response.completed) ||
          !Number.isSafeInteger(response.total) || response.total < 1 ||
          response.completed < 0 || response.completed > response.total) {
          finish(new Error("AUDIO_411_PROGRESS_INVALID: Progresso Worker non valido."));
        } else onRenderFrames?.(response.completed, response.total);
        return;
      }
      if (!response || response.kind !== (job.kind === "preview" ? "preview" : "done") ||
          !response.preview || !Number.isFinite(response.preview.durationSeconds) ||
          !Number.isSafeInteger(response.preview.outputBytes) || response.preview.outputBytes < 46 ||
          !Array.isArray(response.sourceFormats) || response.sourceFormats.length !== job.sources.length ||
          (response.kind === "done" && (!(response.wav instanceof ArrayBuffer) ||
            response.wav.byteLength !== response.preview.outputBytes ||
            !Array.isArray(response.peaks) || response.peaks.length !== BARS ||
            response.peaks.some((peak) => !Number.isFinite(peak) || peak < 0 || peak > 1)))) {
        finish(new Error("AUDIO_231_OUTPUT_VERIFY: Output Worker non coerente."));
        return;
      }
      finish(undefined, response);
    };
    worker.onerror = () => finish(new Error("AUDIO_231_WORKER_FAILED: Elaborazione locale fallita."));
    watchdog = setTimeout(() => finish(new Error("AUDIO_231_WORKER_TIMEOUT: Elaborazione oltre il tempo massimo.")), 60_000);
    if (signal.aborted) { onAbort(); return; }
    try { worker.postMessage(job, job.sources.slice()); }
    catch (error) { finish(error instanceof Error ? error : new Error("AUDIO_231_WORKER_FAILED")); }
  });
}
