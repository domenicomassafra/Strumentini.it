import { inspectMp4Local, type Mp4Inspection } from "./mp4-inspection";

/** Bounded AAC MP4 audio extraction using the browser's decoder and a disposable PCM16 worker.
 * Video frames are never encoded, compressed, modified or trimmed by this operation.
 * The optional range applies only to the decoded audio, after browser decoding/resampling.
 */
export interface VideoAudioRange234 {
  readonly startSeconds: number;
  readonly endSeconds: number | null; // null = entire decoded audio
}

export interface VideoAudioResult234 {
  readonly blob: Blob;
  readonly sampleRate: number;
  readonly channels: number;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly durationSeconds: number;
  readonly sourceBytes: number;
  readonly outputBytes: number;
  readonly sourceCodec: "mp4a";
  readonly outputCodec: "pcm_s16le";
}

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_DURATION = 60;
const MAX_RATE = 96_000;

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Estrazione audio annullata", "AbortError");
}

export function validateAudioSource234(source: Pick<File, "size" | "name">, inspection: Mp4Inspection): void {
  if (!/\.(mp4|m4v)$/iu.test(source.name) || source.size < 1 || source.size > MAX_INPUT_BYTES) {
    throw new Error("VIDEO_AUDIO_SOURCE_LIMIT: È richiesto un MP4/M4V locale, massimo 12 MiB.");
  }
  if (inspection.containsMovieFragments || inspection.durationSeconds === null || !Number.isFinite(inspection.durationSeconds)
    || inspection.durationSeconds <= 0 || inspection.durationSeconds > MAX_DURATION) {
    throw new Error("VIDEO_AUDIO_TIMELINE_UNVERIFIED: MP4 frammentato o durata sconosciuta/oltre 60 s.");
  }
  if (inspection.videoTracks !== 1 || inspection.audioTracks !== 1 || inspection.totalTracks !== 2
    || inspection.tracks.filter((track) => track.kind === "audio")[0]?.codecFourCc !== "mp4a") {
    throw new Error("VIDEO_AUDIO_CODEC_UNSUPPORTED: Solo MP4 con una traccia video e una traccia audio AAC/mp4a; altri codec o tracce multiple non supportati.");
  }
}

export function validateAudioRange234(range: VideoAudioRange234, duration: number, sampleRate: number, channels: number) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8_000 || sampleRate > MAX_RATE
    || !Number.isInteger(channels) || channels < 1 || channels > 2) {
    throw new Error("VIDEO_AUDIO_DECODE_UNSUPPORTED: Il browser ha restituito frequenza/canali non supportati.");
  }
  const endSeconds = range.endSeconds ?? duration;
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION + 0.2
    || !Number.isFinite(range.startSeconds) || !Number.isFinite(endSeconds)
    || range.startSeconds < 0 || endSeconds > duration + 0.000001 || endSeconds - range.startSeconds < 0.05) {
    throw new Error("VIDEO_AUDIO_RANGE: Intervallo non valido; minimo 50 ms, entro la durata decodificata.");
  }
  const startFrame = Math.round(range.startSeconds * sampleRate);
  const endFrame = Math.round(Math.min(endSeconds, duration) * sampleRate);
  const frames = endFrame - startFrame;
  if (frames < 1 || 44 + frames * channels * 2 > MAX_OUTPUT_BYTES) {
    throw new Error("VIDEO_AUDIO_MEMORY_LIMIT: WAV PCM oltre 16 MiB.");
  }
  return { startFrame, endFrame, frames, endSeconds, outputBytes: 44 + frames * channels * 2 };
}

export function verifyWav234(bytes: ArrayBuffer, sampleRate: number, channels: number, frames: number): void {
  const expected = 44 + frames * channels * 2;
  if (bytes.byteLength !== expected) throw new Error("VIDEO_AUDIO_OUTPUT_VERIFY: Dimensione WAV errata.");
  const data = new DataView(bytes);
  const marker = (offset: number) => String.fromCharCode(...new Uint8Array(bytes, offset, 4));
  if (marker(0) !== "RIFF" || marker(8) !== "WAVE" || marker(12) !== "fmt " || marker(36) !== "data"
    || data.getUint32(4, true) !== expected - 8 || data.getUint32(16, true) !== 16
    || data.getUint16(20, true) !== 1 || data.getUint16(22, true) !== channels
    || data.getUint32(24, true) !== sampleRate || data.getUint32(28, true) !== sampleRate * channels * 2
    || data.getUint16(32, true) !== channels * 2 || data.getUint16(34, true) !== 16
    || data.getUint32(40, true) !== expected - 44) {
    throw new Error("VIDEO_AUDIO_OUTPUT_VERIFY: Header WAV PCM16 incoerente.");
  }
}

function writeDecodedWav234(audio: AudioBuffer, begin: number, end: number, signal?: AbortSignal): Promise<ArrayBuffer> {
  cancelled(signal);
  if (typeof Worker === "undefined") throw new Error("VIDEO_AUDIO_WORKER_UNSUPPORTED: Worker non disponibili in questo browser.");
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./wav-worker-234.ts", import.meta.url), { type: "module" });
    let settled = false;
    const finish = (error?: Error, bytes?: ArrayBuffer) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else if (bytes) resolve(bytes);
      else reject(new Error("VIDEO_AUDIO_WORKER_FAILED"));
    };
    const onAbort = () => finish(new DOMException("Estrazione audio annullata", "AbortError"));
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<{ kind: string; bytes?: ArrayBuffer; message?: string }>) => {
      if (event.data.kind === "done" && event.data.bytes instanceof ArrayBuffer) finish(undefined, event.data.bytes);
      else finish(new Error(event.data.message || "VIDEO_AUDIO_WORKER_FAILED"));
    };
    worker.onerror = () => finish(new Error("VIDEO_AUDIO_WORKER_FAILED: Errore codifica PCM."));
    try {
      const channels = Array.from({ length: audio.numberOfChannels }, (_, index) =>
        audio.getChannelData(index).slice(begin, end));
      if (signal?.aborted) { onAbort(); return; }
      worker.postMessage({ kind: "write", channels, sampleRate: audio.sampleRate, frames: end - begin }, channels.map((data) => data.buffer));
    } catch (error) { finish(error instanceof Error ? error : new Error("VIDEO_AUDIO_WORKER_FAILED")); }
  });
}

export async function extractAudioWav234(source: File, range: VideoAudioRange234, signal?: AbortSignal): Promise<VideoAudioResult234> {
  cancelled(signal);
  if (typeof AudioContext === "undefined" || typeof Worker === "undefined") {
    throw new Error("VIDEO_AUDIO_BROWSER_UNSUPPORTED: Decoder audio o Worker assenti.");
  }
  if (source.size < 1 || source.size > MAX_INPUT_BYTES || !/\.(mp4|m4v)$/iu.test(source.name)) {
    throw new Error("VIDEO_AUDIO_SOURCE_LIMIT: È richiesto un MP4/M4V locale, massimo 12 MiB.");
  }
  const inspected = await inspectMp4Local(source, signal);
  validateAudioSource234(source, inspected);
  cancelled(signal);
  const context = new AudioContext({ sampleRate: 48_000 });
  // Abort can arrive while close() is still pending. Reuse exactly one close
  // operation so the abort path and finally never race to close the same
  // AudioContext twice (observed on real Firefox/WebKit browser acceptance).
  let closing: Promise<void> | null = null;
  const closeContext = (): Promise<void> => {
    if (closing !== null) return closing;
    if (context.state === "closed") return Promise.resolve();
    try { closing = context.close().catch(() => undefined); }
    catch { closing = Promise.resolve(); }
    return closing;
  };
  const onAbort = () => { void closeContext(); };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const bytes = await source.arrayBuffer();
    cancelled(signal);
    let audio: AudioBuffer;
    try { audio = await context.decodeAudioData(bytes); }
    catch {
      cancelled(signal);
      throw new Error("VIDEO_AUDIO_DECODE_UNSUPPORTED: Il browser non decodifica la traccia AAC selezionata.");
    }
    cancelled(signal);
    if (Math.abs(audio.duration - inspected.durationSeconds!) > 0.15 || audio.length !== Math.round(audio.duration * audio.sampleRate)) {
      throw new Error("VIDEO_AUDIO_DURATION_MISMATCH: Durata decodificata e durata MP4 incoerenti.");
    }
    const bounded = validateAudioRange234(range, audio.duration, audio.sampleRate, audio.numberOfChannels);
    if (bounded.endFrame > audio.length) throw new Error("VIDEO_AUDIO_RANGE: Fine oltre campioni disponibili.");
    const output = await writeDecodedWav234(audio, bounded.startFrame, bounded.endFrame, signal);
    cancelled(signal);
    verifyWav234(output, audio.sampleRate, audio.numberOfChannels, bounded.frames);
    return {
      blob: new Blob([output], { type: "audio/wav" }), sampleRate: audio.sampleRate, channels: audio.numberOfChannels,
      startSeconds: bounded.startFrame / audio.sampleRate, endSeconds: bounded.endFrame / audio.sampleRate,
      durationSeconds: bounded.frames / audio.sampleRate, sourceBytes: source.size, outputBytes: output.byteLength,
      sourceCodec: "mp4a", outputCodec: "pcm_s16le",
    };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await closeContext();
  }
}
