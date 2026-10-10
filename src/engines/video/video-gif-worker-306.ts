/**
 * #306 one-job disposable WebCodecs decoder/GIF encoder worker.
 * Reads source via the already-approved Mediabunny MPL-2.0 donor (#234);
 * uses independently MIT-licensed gifenc@1.0.3 for real GIF89a output.
 */
import { ALL_FORMATS, BlobSource, CanvasSink, Input, canDecodeVideo } from "./vendor/mediabunny-mpl-1.61.3/index.mjs";
import { GIFEncoder, applyPalette, quantize } from "./vendor/gifenc-mit-1.0.3/index.mjs";
import { VIDEO_GIF_306_LIMITS } from "./video-gif-306";

type Request = { kind: "convert"; source: Blob; start: number; end: number | null; fps: 5 | 10; maxWidth: number };
type Response =
  | { kind: "done"; buffer: ArrayBuffer; width: number; height: number; frames: number; delaysCs: number[]; start: number; end: number }
  | { kind: "progress"; done: number; total: number }
  | { kind: "error"; message: string };

async function processRequest(request: Request): Promise<void> {
  let input: Input | undefined;
  try {
    if (typeof OffscreenCanvas === "undefined" || typeof VideoDecoder === "undefined") {
      throw new Error("VIDEO_GIF_306_UNSUPPORTED: WebCodecs/OffscreenCanvas non disponibili.");
    }
    if (request.source.size < 64 || request.source.size > VIDEO_GIF_306_LIMITS.sourceBytes
      || (request.fps !== 5 && request.fps !== 10)
      || !Number.isFinite(request.start) || request.start < 0
      || !Number.isInteger(request.maxWidth) || request.maxWidth < 16 || request.maxWidth > 256) {
      throw new Error("VIDEO_GIF_306_INPUT_LIMIT: Sorgente o opzioni eccedono i limiti.");
    }
    input = new Input({ source: new BlobSource(request.source, { maxCacheSize: 1024 * 1024 }), formats: ALL_FORMATS });
    const tracks = await input.getTracks();
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    if (!video || tracks.length !== (audio ? 2 : 1)) {
      throw new Error("VIDEO_GIF_306_TRACK_LIMIT: Una traccia video e massimo una audio.");
    }
    const [codec, displayW, displayH, duration] = await Promise.all([
      video.getCodec(), video.getDisplayWidth(), video.getDisplayHeight(), input.computeDuration(),
    ]);
    if (codec !== "avc" && codec !== "vp8") {
      throw new Error("VIDEO_GIF_306_CODEC_UNSUPPORTED: Solo H.264 o VP8 verificati.");
    }
    if (!(await canDecodeVideo(codec))) {
      throw new Error("VIDEO_GIF_306_DECODER_UNSUPPORTED: Browser non decodifica il codec video.");
    }
    if (!Number.isFinite(duration) || duration < 0.2 || duration > VIDEO_GIF_306_LIMITS.sourceSeconds
      || !Number.isFinite(displayW) || !Number.isFinite(displayH) || displayW < 2 || displayH < 2
      || displayW * displayH > VIDEO_GIF_306_LIMITS.sourcePixels
      || displayW > 1280 || displayH > 720) {
      throw new Error("VIDEO_GIF_306_SOURCE_LIMIT: Sorgente massimo 12 secondi e 1280×720.");
    }
    const end = request.end ?? Math.min(duration, request.start + 3);
    const seconds = end - request.start;
    if (!Number.isFinite(end) || seconds < 0.2 || seconds > VIDEO_GIF_306_LIMITS.maxDuration + 0.000001
      || end > duration + 0.001) {
      throw new Error("VIDEO_GIF_306_TRIM_RANGE: Intervallo 0,2–3 s entro durata.");
    }
    const frames = Math.ceil(seconds * request.fps - 1e-7);
    if (frames < 2 || frames > VIDEO_GIF_306_LIMITS.maxFrames) {
      throw new Error("VIDEO_GIF_306_FRAME_LIMIT: Massimo 30 fotogrammi.");
    }
    const factor = Math.min(1, request.maxWidth / displayW, VIDEO_GIF_306_LIMITS.maxDimension / displayH);
    const width = Math.max(1, Math.round(displayW * factor));
    const height = Math.max(1, Math.round(displayH * factor));
    if (width * height > VIDEO_GIF_306_LIMITS.maxFramePixels
      || width * height * frames > VIDEO_GIF_306_LIMITS.maxDecodedPixels) {
      throw new Error("VIDEO_GIF_306_PIXEL_LIMIT: Troppe immagini per il budget.");
    }

    // Two buffers only: reusable decoded canvas and the current RGBA frame.
    // No list of all source frames or full-size intermediate PNGs is retained.
    const sink = new CanvasSink(video, { width, height, fit: "contain", poolSize: 1 });
    const timestamps = Array.from({ length: frames }, (_, i) =>
      Math.min(end - 0.000001, request.start + (i + 0.5) * seconds / frames));
    const stream = GIFEncoder();
    const totalCs = Math.round(seconds * 100);
    const delaysCs: number[] = [];
    let count = 0;
    for await (const frame of sink.canvasesAtTimestamps(timestamps)) {
      if (!frame) throw new Error("VIDEO_GIF_306_MISSING_FRAME: Fotogramma non decodificato.");
      const time = timestamps[count]!;
      if (!Number.isFinite(frame.timestamp) || frame.timestamp > time + 0.001 || time - frame.timestamp > 0.25) {
        throw new Error("VIDEO_GIF_306_TIMESTAMP: Fotogramma troppo distante dal tempo richiesto.");
      }
      const context = frame.canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("VIDEO_GIF_306_CANVAS: Pixel non disponibili.");
      const rgba = context.getImageData(0, 0, width, height).data;
      const palette = quantize(rgba, 128);
      const indices = applyPalette(rgba, palette);
      const currentCs = Math.round((count + 1) * totalCs / frames) - Math.round(count * totalCs / frames);
      if (currentCs < 2) throw new Error("VIDEO_GIF_306_DELAY: Frame più breve della soglia GIF 20ms.");
      stream.writeFrame(indices, width, height, { palette, delay: currentCs * 10, repeat: 0, dispose: 2 });
      delaysCs.push(currentCs);
      count++;
      self.postMessage({ kind: "progress", done: count, total: frames } satisfies Response);
    }
    if (count !== frames || delaysCs.reduce((sum, cs) => sum + cs, 0) !== totalCs) {
      throw new Error("VIDEO_GIF_306_FRAMES: Fotogrammi o ritardi persi.");
    }
    stream.finish();
    const output = stream.bytes();
    if (output.byteLength < 50 || output.byteLength > VIDEO_GIF_306_LIMITS.maxGifBytes) {
      throw new Error("VIDEO_GIF_306_OUTPUT_LIMIT: Output non verificabile o oltre 6 MiB.");
    }
    const data = Uint8Array.from(output).buffer;
    self.postMessage({ kind: "done", buffer: data, width, height, frames, delaysCs,
      start: request.start, end } satisfies Response, { transfer: [data] });
  } finally {
    input?.dispose();
  }
}

self.onmessage = (event: MessageEvent<Request>) => {
  void processRequest(event.data).catch((cause: unknown) => {
    self.postMessage({ kind: "error", message: cause instanceof Error
      ? cause.message : "VIDEO_GIF_306_WORKER: GIF non prodotto." } satisfies Response);
  });
};
