import { inspectMp4Local, type Mp4Inspection } from "./mp4-inspection";

export const VIDEO_234_LIMITS = Object.freeze({
  inputBytes: 12 * 1024 * 1024, outputBytes: 18 * 1024 * 1024,
  maxDurationSeconds: 12, maxWidth: 1280, maxHeight: 720,
  maxPixels: 921_600, minTrimSeconds: 0.4,
  minBitrateBps: 180_000, maxBitrateBps: 3_000_000,
});

export interface VideoTransformOptions234 {
  readonly start: number;
  readonly end: number | null;
  readonly width: number;
  readonly height: number;
  readonly videoBitrateBps: number;
}

export interface VideoTransformResult234 {
  readonly blob: Blob;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly start: number;
  readonly end: number;
  readonly duration: number;
  readonly outputVideoCodec: "avc1";
  readonly outputAudioCodec: "mp4a";
  readonly sourceBytes: number;
  readonly videoBitrateBps: number;
  /** Measured from the actual input by the worker before converting. */
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly sourceVideoCodec: "avc" | "vp8";
  readonly sourceAudioCodec: "aac" | "opus";
  readonly sourceDurationSeconds: number;
  /** Measured container bitrate, not a claim about H.264 track rate control. */
  readonly actualTotalBitrateBps: number;
}

type WorkerResponse =
  | { kind: "capability"; supported: boolean; reason: string }
  | { kind: "done"; bytes: ArrayBuffer }
  | { kind: "progress"; progress: number; processedTime: number }
  | { kind: "error"; message: string };

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("VIDEO_234_CANCELLED: Conversione annullata.", "AbortError");
}

export function validateVideoTransform234(source: Pick<File, "name" | "size">, inspected: Mp4Inspection, options: VideoTransformOptions234) {
  if (!/\.(mp4|m4v)$/iu.test(source.name) || source.size < 64 || source.size > VIDEO_234_LIMITS.inputBytes) {
    throw new Error("VIDEO_234_INPUT_LIMIT: Seleziona MP4/M4V locale entro 12 MiB.");
  }
  const duration = inspected.durationSeconds;
  if (inspected.containsMovieFragments || duration === null || duration < VIDEO_234_LIMITS.minTrimSeconds
    || duration > VIDEO_234_LIMITS.maxDurationSeconds
    || inspected.totalTracks !== 2 || inspected.videoTracks !== 1 || inspected.audioTracks !== 1) {
    throw new Error("VIDEO_234_INPUT_UNSUPPORTED: Richiesti MP4 non frammentati, 0,4–12 s, una traccia video e una AAC.");
  }
  const video = inspected.tracks.find(track => track.kind === "video");
  const audio = inspected.tracks.find(track => track.kind === "audio");
  if (video?.codecFourCc !== "avc1" || audio?.codecFourCc !== "mp4a" || video.width === null || video.height === null
    || video.width === undefined || video.height === undefined || video.width < 2 || video.height < 2
    || video.width > VIDEO_234_LIMITS.maxWidth || video.height > VIDEO_234_LIMITS.maxHeight) {
    throw new Error("VIDEO_234_CODEC_UNSUPPORTED: Sorgente deve essere H.264 (avc1), AAC (mp4a), fino a 1280×720.");
  }
  const end = options.end ?? duration;
  if (!Number.isFinite(options.start) || !Number.isFinite(end) || options.start < 0
    || end > duration + 0.001 || end - options.start < VIDEO_234_LIMITS.minTrimSeconds) {
    throw new Error("VIDEO_234_TRIM_RANGE: Durata minima 0,4 s; intervallo entro il file video.");
  }
  if (!Number.isInteger(options.width) || !Number.isInteger(options.height)
    || options.width < 32 || options.height < 32
    || options.width % 2 || options.height % 2
    || options.width > VIDEO_234_LIMITS.maxWidth || options.height > VIDEO_234_LIMITS.maxHeight
    || options.width * options.height > VIDEO_234_LIMITS.maxPixels) {
    throw new Error("VIDEO_234_OUTPUT_DIMENSIONS: Dimensioni video pari 32–1280 × 32–720 entro 921600 pixel.");
  }
  if (!Number.isInteger(options.videoBitrateBps) || options.videoBitrateBps < VIDEO_234_LIMITS.minBitrateBps
    || options.videoBitrateBps > VIDEO_234_LIMITS.maxBitrateBps) {
    throw new Error("VIDEO_234_BITRATE: Bitrate richiesto 180–3000 kbit/s.");
  }
  return { end, duration };
}

/** Disposable worker per probe/conversion. Aborts and timeouts terminate it;
 * no partial MP4 is returned, even if a late worker message is delivered. */
function runWorker<T>(message: object, expected: WorkerResponse["kind"], signal?: AbortSignal, onProgress?: (progress: number) => void): Promise<T> {
  aborted(signal);
  if (typeof Worker === "undefined") throw new Error("VIDEO_234_BROWSER_UNSUPPORTED: Web Worker non disponibile.");
  return new Promise<T>((resolve, reject) => {
    let closed = false;
    const worker = new Worker(new URL("./video-transform-worker-234.ts", import.meta.url), { type: "module" });
    const finish = (value?: T, err?: Error) => {
      if (closed) return;
      closed = true;
      clearTimeout(timeout);
      worker.terminate();
      signal?.removeEventListener("abort", cancel);
      if (err) reject(err);
      else resolve(value as T);
    };
    const cancel = () => finish(undefined, new DOMException("VIDEO_234_CANCELLED", "AbortError"));
    const timeout = setTimeout(() => finish(undefined, new Error("VIDEO_234_TIMEOUT: Codifica oltre il limite di esecuzione.")), 60_000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onerror = () => finish(undefined, new Error("VIDEO_234_WORKER_FAILED: Worker WebCodecs non disponibile."));
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const packet = event.data;
      if (packet.kind === "error") finish(undefined, new Error(packet.message));
      else if (packet.kind === "progress") onProgress?.(packet.progress);
      else if (packet.kind !== expected) finish(undefined, new Error("VIDEO_234_WORKER_PROTOCOL: Risposta non valida."));
      else finish(packet as T);
    };
    try {
      if (signal?.aborted) { cancel(); return; }
      worker.postMessage(message);
    } catch { finish(undefined, new Error("VIDEO_234_WORKER_FAILED: Invio sorgente non riuscito.")); }
  });
}

export async function probeVideoTransform234(width: number, height: number, signal?: AbortSignal, sourceKind: "mp4" | "webm" = "mp4") {
  return runWorker<{ kind: "capability"; supported: boolean; reason: string }>({ kind: "probe", width, height, sourceKind }, "capability", signal);
}

export async function transformVideoMp4Local234(file: File, options: VideoTransformOptions234, signal?: AbortSignal, onProgress?: (progress: number) => void): Promise<VideoTransformResult234> {
  aborted(signal);
  if (file.size < 64 || file.size > VIDEO_234_LIMITS.inputBytes || !/\.(mp4|m4v|webm)$/iu.test(file.name)) {
    throw new Error("VIDEO_234_INPUT_LIMIT: Seleziona MP4/M4V/WebM entro 12 MiB.");
  }
  const sourceKind = /\.webm$/iu.test(file.name) ? "webm" : "mp4";
  let end = options.end;
  if (sourceKind === "mp4") {
    const input = await inspectMp4Local(file, signal);
    end = validateVideoTransform234(file, input, options).end;
  } else {
    if (!Number.isFinite(options.start) || options.start < 0 || (end !== null && (!Number.isFinite(end) || end - options.start < 0.4))) {
      throw new Error("VIDEO_234_TRIM_RANGE: Intervallo non valido.");
    }
    // The worker parses WebM's actual tracks, codecs and duration before encoding.
    // It rejects unsupported codecs without producing any partial result.
    if (!Number.isInteger(options.width) || !Number.isInteger(options.height)
      || options.width < 32 || options.height < 32 || options.width % 2 || options.height % 2
      || options.width > 1280 || options.height > 720 || options.width * options.height > VIDEO_234_LIMITS.maxPixels
      || !Number.isInteger(options.videoBitrateBps) || options.videoBitrateBps < VIDEO_234_LIMITS.minBitrateBps
      || options.videoBitrateBps > VIDEO_234_LIMITS.maxBitrateBps) {
      throw new Error("VIDEO_234_SETTINGS: Dimensioni o bitrate fuori intervallo.");
    }
  }
  aborted(signal);
  const response = await runWorker<{ kind: "done"; bytes: ArrayBuffer; start: number; end: number;
    originalWidth: number; originalHeight: number; originalVideoCodec: "avc" | "vp8";
    originalAudioCodec: "aac" | "opus"; originalDuration: number }>({
    kind: "convert", source: file, start: options.start, end,
    width: options.width, height: options.height, videoBitrateBps: options.videoBitrateBps, sourceKind,
  }, "done", signal, onProgress);
  aborted(signal);
  if (!(response.bytes instanceof ArrayBuffer) || response.bytes.byteLength > VIDEO_234_LIMITS.outputBytes
    || response.bytes.byteLength < 128) throw new Error("VIDEO_234_OUTPUT_LIMIT: Output fuori budget.");
  const head = new Uint8Array(response.bytes, 0, 16);
  if (String.fromCharCode(...head.subarray(4, 8)) !== "ftyp") throw new Error("VIDEO_234_OUTPUT_SIGNATURE: File non MP4.");
  const blob = new Blob([response.bytes], { type: "video/mp4" });
  const output = await inspectMp4Local(blob, signal);
  aborted(signal);
  const video = output.tracks.find(track => track.kind === "video");
  const audio = output.tracks.find(track => track.kind === "audio");
  const expectedDuration = response.end - options.start;
  if (response.originalWidth < 2 || response.originalHeight < 2 ||
    !Number.isFinite(response.originalDuration) || response.originalDuration <= 0 ||
    !["avc", "vp8"].includes(response.originalVideoCodec) ||
    !["aac", "opus"].includes(response.originalAudioCodec)) {
    throw new Error("VIDEO_38_SOURCE_VERIFY: Parametri video/audio di origine non verificabili.");
  }
  if (output.containsMovieFragments || output.totalTracks !== 2 || output.videoTracks !== 1 || output.audioTracks !== 1
    || video?.codecFourCc !== "avc1" || audio?.codecFourCc !== "mp4a"
    || video.width !== options.width || video.height !== options.height || output.durationSeconds === null
    || Math.abs(output.durationSeconds - expectedDuration) > 0.18) {
    throw new Error("VIDEO_234_OUTPUT_VERIFY: Video/audio/size/durata MP4 non verificati.");
  }
  return { blob, bytes: response.bytes.byteLength, width: options.width, height: options.height,
    start: options.start, end: response.end, duration: output.durationSeconds, videoBitrateBps: options.videoBitrateBps,
    sourceBytes: file.size, outputVideoCodec: "avc1", outputAudioCodec: "mp4a",
    sourceWidth: response.originalWidth, sourceHeight: response.originalHeight,
    sourceVideoCodec: response.originalVideoCodec, sourceAudioCodec: response.originalAudioCodec,
    sourceDurationSeconds: response.originalDuration,
    actualTotalBitrateBps: Math.round(response.bytes.byteLength * 8 / output.durationSeconds),
  };
}
