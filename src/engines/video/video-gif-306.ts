import { inspectGifStructure } from "../image/gif-structure";
import { inspectMp4Local } from "./mp4-inspection";

/** Strict limits apply before allocating the worker/decoders. */
export const VIDEO_GIF_306_LIMITS = Object.freeze({
  sourceBytes: 12 * 1024 * 1024,
  sourceSeconds: 12,
  sourcePixels: 1280 * 720,
  maxDuration: 3,
  maxFrames: 30,
  maxDimension: 256,
  maxFramePixels: 256 * 256,
  maxDecodedPixels: 30 * 256 * 256,
  maxGifBytes: 6 * 1024 * 1024,
});

export type VideoGif306Options = {
  readonly start: number;
  /** Null means min(file end, start+3s), determined from actual video metadata. */
  readonly end: number | null;
  readonly fps: 5 | 10;
  /** Maximum output width in pixels, before applying scale. */
  readonly maxWidth: number;
  readonly scale: 0.5 | 1;
};

export type VideoGif306Result = {
  readonly blob: Blob;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly frames: number;
  readonly delaysCentiseconds: readonly number[];
  readonly durationSeconds: number;
  readonly start: number;
  readonly end: number;
  readonly sourceBytes: number;
  readonly colorMode: "128-colors-per-frame";
};

export function videoGif306Plan(file: Pick<File, "size" | "name">, options: VideoGif306Options, declaredDuration?: number): {
  start: number; end: number | null; frames: number | null; maxWidth: number; maxHeight: number;
} {
  if (file.size < 64 || file.size > VIDEO_GIF_306_LIMITS.sourceBytes || !/\.(mp4|m4v|webm)$/iu.test(file.name)) {
    throw new Error("VIDEO_GIF_306_INPUT_LIMIT: Solo MP4/M4V/WebM locali 64 byte–12 MiB.");
  }
  if (!Number.isFinite(options.start) || options.start < 0 || (options.fps !== 5 && options.fps !== 10)
    || !Number.isInteger(options.maxWidth) || options.maxWidth < 32 || options.maxWidth > 256
    || (options.scale !== 0.5 && options.scale !== 1)) {
    throw new Error("VIDEO_GIF_306_SETTINGS: FPS 5/10, larghezza 32–256, scala 50/100%, inizio positivo.");
  }
  if (declaredDuration !== undefined && (!Number.isFinite(declaredDuration) || declaredDuration <= 0
    || declaredDuration > VIDEO_GIF_306_LIMITS.sourceSeconds)) {
    throw new Error("VIDEO_GIF_306_DURATION_LIMIT: Sorgente massimo 12 s.");
  }
  const end = options.end ?? (declaredDuration === undefined ? null : Math.min(declaredDuration, options.start + 3));
  if (end !== null && (!Number.isFinite(end) || end - options.start < 0.2
    || end - options.start > VIDEO_GIF_306_LIMITS.maxDuration + 0.000001
    || (declaredDuration !== undefined && end > declaredDuration + 0.001))) {
    throw new Error("VIDEO_GIF_306_TRIM_RANGE: Seleziona 0,2–3 s entro la durata del video.");
  }
  const frames = end === null ? null : Math.ceil((end - options.start) * options.fps - 1e-7);
  if (frames !== null && (frames < 2 || frames > VIDEO_GIF_306_LIMITS.maxFrames)) {
    throw new Error("VIDEO_GIF_306_FRAME_LIMIT: Il GIF deve contenere 2–30 frame.");
  }
  const maxWidth = Math.round(options.maxWidth * options.scale);
  if (maxWidth < 16) throw new Error("VIDEO_GIF_306_PIXEL_LIMIT: Scala troppo piccola.");
  return { start: options.start, end, frames, maxWidth, maxHeight: VIDEO_GIF_306_LIMITS.maxDimension };
}

type GifWorkerResponse =
  | { kind: "done"; buffer: ArrayBuffer; width: number; height: number; frames: number; delaysCs: number[]; start: number; end: number }
  | { kind: "progress"; done: number; total: number }
  | { kind: "error"; message: string };

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("VIDEO_GIF_306_CANCELLED: conversione annullata.", "AbortError");
}

export async function videoToGif306(file: File, options: VideoGif306Options,
  signal?: AbortSignal, onProgress?: (done: number, total: number) => void): Promise<VideoGif306Result> {
  abortIfNeeded(signal);
  let plan = videoGif306Plan(file, options);
  if (/\.(mp4|m4v)$/iu.test(file.name)) {
    const inspection = await inspectMp4Local(file, signal);
    if (inspection.containsMovieFragments || inspection.videoTracks !== 1
      || inspection.videoTracks + inspection.audioTracks !== inspection.totalTracks
      || !inspection.tracks.some(track => track.kind === "video" && track.codecFourCc === "avc1")) {
      throw new Error("VIDEO_GIF_306_CODEC_UNSUPPORTED: MP4 non frammentato H.264, una sola traccia video.");
    }
    plan = videoGif306Plan(file, options, inspection.durationSeconds ?? undefined);
  }
  abortIfNeeded(signal);
  if (typeof Worker === "undefined") throw new Error("VIDEO_GIF_306_UNSUPPORTED: Web Worker assente.");
  const response = await new Promise<Extract<GifWorkerResponse, { kind: "done" }>>((resolve, reject) => {
    const worker = new Worker(new URL("./video-gif-worker-306.ts", import.meta.url), { type: "module" });
    let settled = false;
    const finish = (value?: Extract<GifWorkerResponse, { kind: "done" }>, error?: Error) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (error) reject(error); else if (value) resolve(value);
      else reject(new Error("VIDEO_GIF_306_WORKER: Output mancante."));
    };
    const cancel = () => finish(undefined, new DOMException("VIDEO_GIF_306_CANCELLED", "AbortError"));
    const timer = setTimeout(() => finish(undefined, new Error("VIDEO_GIF_306_TIMEOUT: limite 60 secondi.")), 60_000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onerror = () => finish(undefined, new Error("VIDEO_GIF_306_WORKER: Errore decoder/encoder."));
    worker.onmessage = (event: MessageEvent<GifWorkerResponse>) => {
      const packet = event.data;
      if (packet.kind === "error") finish(undefined, new Error(packet.message));
      else if (packet.kind === "progress") onProgress?.(packet.done, packet.total);
      else finish(packet);
    };
    try {
      if (signal?.aborted) { cancel(); return; }
      worker.postMessage({ kind: "convert", source: file, start: plan.start, end: plan.end,
        maxWidth: plan.maxWidth, fps: options.fps });
    } catch { finish(undefined, new Error("VIDEO_GIF_306_WORKER: Trasferimento sorgente fallito.")); }
  });
  abortIfNeeded(signal);
  if (!(response.buffer instanceof ArrayBuffer) || response.buffer.byteLength > VIDEO_GIF_306_LIMITS.maxGifBytes) {
    throw new Error("VIDEO_GIF_306_OUTPUT_LIMIT: GIF oltre 6 MiB.");
  }
  const raw = new Uint8Array(response.buffer);
  const gif = inspectGifStructure(raw);
  const intendedCs = Math.round((response.end - response.start) * 100);
  if (!gif.animated || gif.frameCount !== response.frames || gif.frameCount !== response.delaysCs.length
    || gif.width !== response.width || gif.height !== response.height
    || gif.totalDelayCentiseconds !== response.delaysCs.reduce((sum, n) => sum + n, 0)
    || Math.abs(gif.totalDelayCentiseconds - intendedCs) > 1
    || gif.frameDelaysCentiseconds.some((delay, i) => delay !== response.delaysCs[i])) {
    throw new Error("VIDEO_GIF_306_VERIFY: Firma, frame, colori o ritardi GIF incoerenti.");
  }
  abortIfNeeded(signal);
  return {
    blob: new Blob([response.buffer], { type: "image/gif" }),
    bytes: response.buffer.byteLength, width: gif.width, height: gif.height,
    frames: gif.frameCount, delaysCentiseconds: gif.frameDelaysCentiseconds,
    durationSeconds: gif.totalDelayCentiseconds / 100,
    start: response.start, end: response.end, sourceBytes: file.size, colorMode: "128-colors-per-frame",
  };
}
