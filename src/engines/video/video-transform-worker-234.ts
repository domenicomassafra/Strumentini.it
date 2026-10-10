/** Disposable conversion Worker: vendored MPL-2.0 Mediabunny 1.61.3 + browser WebCodecs. */
import {
  ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output,
  canDecodeAudio, canDecodeVideo, canEncodeAudio, canEncodeVideo,
} from "./vendor/mediabunny-mpl-1.61.3/index.mjs";

type Options = {
  readonly kind: "convert";
  readonly source: Blob;
  readonly start: number;
  readonly end: number | null;
  readonly width: number;
  readonly height: number;
  readonly videoBitrateBps: number;
  readonly sourceKind: "mp4" | "webm";
};
type WorkerRequest = Options | { readonly kind: "probe"; readonly width: number; readonly height: number; readonly sourceKind: "mp4" | "webm" };
type WorkerResult =
  | { kind: "capability"; supported: boolean; reason: string }
  | { kind: "done"; bytes: ArrayBuffer; start: number; end: number;
      originalWidth: number; originalHeight: number; originalVideoCodec: "avc" | "vp8";
      originalAudioCodec: "aac" | "opus"; originalDuration: number }
  | { kind: "progress"; progress: number; processedTime: number }
  | { kind: "error"; message: string };

async function canOperate(width: number, height: number, sourceKind: "mp4" | "webm") {
  const decoderVideoCodec = sourceKind === "webm" ? "vp8" : "avc";
  const decoderAudioCodec = sourceKind === "webm" ? "opus" : "aac";
  const diagnostics: string[] = [];
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined"
    || typeof AudioEncoder === "undefined" || typeof AudioDecoder === "undefined") {
    return { supported: false, reason: "WebCodecs Audio/Video encoder o decoder assenti nel browser." };
  }
  for (const [name, check] of [
    [`${decoderVideoCodec} decodifica`, () => canDecodeVideo(decoderVideoCodec)],
    [`${decoderAudioCodec} decodifica`, () => canDecodeAudio(decoderAudioCodec, { sampleRate: 48000, numberOfChannels: 1 })],
    ["H.264 codifica", () => canEncodeVideo("avc", { width, height, bitrate: 600_000, frameRate: 30 })],
    ["AAC codifica", () => canEncodeAudio("aac", { sampleRate: 48000, numberOfChannels: 1, bitrate: 96_000 })],
  ] as const) {
    let yes = false;
    try { yes = await check(); } catch { /* unsupported codec */ }
    if (!yes) diagnostics.push(name);
  }
  return { supported: diagnostics.length === 0, reason: diagnostics.length === 0 ? "H.264 + AAC codifica e decodifica WebCodecs verificate." : `Non disponibili: ${diagnostics.join(", ")}` };
}

async function run(data: WorkerRequest) {
  if (data.kind === "probe") {
    const tested = await canOperate(data.width, data.height, data.sourceKind);
    self.postMessage({ kind: "capability", ...tested } satisfies WorkerResult);
    return;
  }
  let input: InstanceType<typeof Input> | undefined;
  let conversion: Awaited<ReturnType<typeof Conversion.init>> | undefined;
  try {
    const supported = await canOperate(data.width, data.height, data.sourceKind);
    if (!supported.supported) throw new Error(`VIDEO_234_CODEC_UNAVAILABLE: ${supported.reason}`);
    input = new Input({ source: new BlobSource(data.source, { maxCacheSize: 1024 * 1024 }), formats: ALL_FORMATS });
    const tracks = await input.getTracks();
    const sourceVideo = await input.getPrimaryVideoTrack();
    const sourceAudio = await input.getPrimaryAudioTrack();
    if (tracks.length !== 2 || !sourceVideo || !sourceAudio) {
      throw new Error("VIDEO_234_TRACKS_UNSUPPORTED: Richieste una traccia video e una audio, senza tracce aggiuntive.");
    }
    const [videoCodec, audioCodec, originalWidth, originalHeight, duration] = await Promise.all([
      sourceVideo.getCodec(), sourceAudio.getCodec(), sourceVideo.getCodedWidth(),
      sourceVideo.getCodedHeight(), input.computeDuration(),
    ]);
    const expectedVideo = data.sourceKind === "webm" ? "vp8" : "avc";
    const expectedAudio = data.sourceKind === "webm" ? "opus" : "aac";
    if (videoCodec !== expectedVideo || audioCodec !== expectedAudio) {
      throw new Error(`VIDEO_234_SOURCE_CODEC: Sorgente ${data.sourceKind} deve contenere ${expectedVideo} e ${expectedAudio}.`);
    }
    if (!Number.isFinite(duration) || duration < 0.4 || duration > 12
      || originalWidth < 2 || originalHeight < 2 || originalWidth > 1280 || originalHeight > 720) {
      throw new Error("VIDEO_234_INPUT_LIMIT: Durata 0,4–12 s e sorgente massimo 1280×720.");
    }
    const end = data.end ?? duration;
    if (!Number.isFinite(end) || !Number.isFinite(data.start) || data.start < 0 || end > duration + 0.001
      || end - data.start < 0.4) {
      throw new Error("VIDEO_234_TRIM_RANGE: Intervallo fuori dalla durata sorgente.");
    }
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });
    conversion = await Conversion.init({
      input, output, tracks: "primary",
      trim: { start: data.start, end },
      // Always genuinely reencode both tracks; never pretend a stream-copy is
      // compression or a frame-accurate trim.
      copy: false,
      video: { codec: "avc", width: data.width, height: data.height, fit: "contain", bitrate: data.videoBitrateBps, forceTranscode: true },
      audio: { codec: "aac", bitrate: 96_000, forceTranscode: true },
      tags: {}, showWarnings: false,
    });
    if (!conversion.isValid || conversion.discardedTracks.length !== 0 || conversion.utilizedTracks.length !== 2) {
      throw new Error("VIDEO_234_TRACK_LOSS: Impossibile includere audio e video nella stessa conversione.");
    }
    conversion.onProgress = (progress, processedTime) => {
      self.postMessage({ kind: "progress", progress, processedTime });
    };
    self.postMessage({ kind: "progress", progress: 0, processedTime: 0 });
    await conversion.execute();
    const bytes = target.buffer;
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 128 || bytes.byteLength > 18 * 1024 * 1024) {
      throw new Error("VIDEO_234_OUTPUT_LIMIT: MP4 codificato nullo o superiore a 18 MiB.");
    }
    self.postMessage({
      kind: "done", bytes, start: data.start, end, originalWidth, originalHeight,
      originalVideoCodec: expectedVideo, originalAudioCodec: expectedAudio, originalDuration: duration,
    } satisfies WorkerResult, { transfer: [bytes] });
  } catch (error) {
    if (conversion) await conversion.cancel().catch(() => undefined);
    throw error;
  } finally {
    // Input also owns source stream readers and decoder caches.
    input?.dispose();
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void run(event.data).catch((error: unknown) => {
    self.postMessage({
      kind: "error",
      message: error instanceof Error ? error.message : "VIDEO_234_WORKER_FAILED: Codifica non disponibile.",
    } satisfies WorkerResult);
  });
};
