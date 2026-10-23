/** STR-424: native browser audio encoding, with measured output and fail-closed formats. */
export const AUDIO_424_MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_SECONDS = 60;
const MAX_OUTPUT_BYTES = AUDIO_424_MAX_INPUT_BYTES;

export const AUDIO_424_FORMATS = [
  { mime: "audio/webm;codecs=opus", label: "WebM · Opus", extension: "webm" },
  { mime: "audio/ogg;codecs=opus", label: "Ogg · Opus", extension: "ogg" },
  { mime: "audio/mp4", label: "MP4 · AAC", extension: "m4a" },
] as const;
export type AudioFormat424 = (typeof AUDIO_424_FORMATS)[number];
export const AUDIO_424_BITRATES_KBPS = [48, 64, 96, 128, 192] as const;

export function availableAudioFormats424(probe?: (mime: string) => boolean): AudioFormat424[] {
  if (!probe) return [];
  return AUDIO_424_FORMATS.filter(({ mime }) => {
    try { return probe(mime) === true; } catch { return false; }
  });
}

export function validateAudioTarget424(kbps: number): number {
  if (!AUDIO_424_BITRATES_KBPS.some((target) => target === kbps)) throw new Error("AUDIO_424_BITRATE_UNSUPPORTED");
  return kbps * 1000;
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const sequence = new TextEncoder().encode(value);
  outer: for (let i = 0; i <= bytes.length - sequence.length; i++) {
    for (let j = 0; j < sequence.length; j++) if (bytes[i + j] !== sequence[j]) continue outer;
    return true;
  }
  return false;
}

export function inspectAudioContainer424(bytes: Uint8Array, requestedMime: string): {
  container: "WebM" | "Ogg" | "MP4"; codec: "Opus" | "AAC";
} {
  if (!AUDIO_424_FORMATS.some(({ mime }) => mime === requestedMime)) throw new Error("AUDIO_424_FORMAT_UNSUPPORTED");
  if (bytes.length < 64) throw new Error("AUDIO_424_EMPTY_OUTPUT");
  if (requestedMime.startsWith("audio/webm")) {
    if (bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
      throw new Error("AUDIO_424_CONTAINER_MISMATCH");
    }
    if (!containsAscii(bytes, "OpusHead")) throw new Error("AUDIO_424_CODEC_UNVERIFIED");
    return { container: "WebM", codec: "Opus" };
  }
  if (requestedMime.startsWith("audio/ogg")) {
    if (!containsAscii(bytes.subarray(0, 4), "OggS")) throw new Error("AUDIO_424_CONTAINER_MISMATCH");
    if (!containsAscii(bytes, "OpusHead")) throw new Error("AUDIO_424_CODEC_UNVERIFIED");
    return { container: "Ogg", codec: "Opus" };
  }
  if (String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp") throw new Error("AUDIO_424_CONTAINER_MISMATCH");
  if (!containsAscii(bytes, "mp4a")) throw new Error("AUDIO_424_CODEC_UNVERIFIED");
  return { container: "MP4", codec: "AAC" };
}

export function measureEncodedAudio424(inputBytes: number, outputBytes: number, seconds: number) {
  if (!Number.isFinite(outputBytes) || outputBytes <= 0) throw new Error("AUDIO_424_EMPTY_OUTPUT");
  if (!Number.isFinite(inputBytes) || inputBytes <= 0 || !Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("AUDIO_424_MEASURE_INVALID");
  }
  return {
    actualKbps: Math.round((outputBytes * 8 / seconds / 1000) * 100) / 100,
    savedPercent: Math.round((1 - outputBytes / inputBytes) * 10000) / 100,
  };
}

function signalEnergy(buffer: AudioBuffer): number {
  let power = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
    power += sum / samples.length;
  }
  return Math.sqrt(power / buffer.numberOfChannels);
}

/** Browser decode/resume can stall (notably when audio is suspended). Cancellation must settle. */
function boundedStage424<T>(operation: Promise<T>, signal: AbortSignal, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const onAbort = () => finish(new DOMException("Conversione annullata", "AbortError"));
    const timeout = setTimeout(() => finish(new Error("AUDIO_424_TIMEOUT")), timeoutMs);
    const finish = (error?: Error, value?: T) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve(value as T);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    operation.then((value) => finish(undefined, value), (error: unknown) => finish(error instanceof Error ? error : new Error("AUDIO_424_STAGE_FAILED")));
  });
}

export interface TranscodedAudio424 {
  readonly blob: Blob;
  readonly mime: string;
  readonly container: "WebM" | "Ogg" | "MP4";
  readonly codec: "Opus" | "AAC";
  readonly durationSeconds: number;
  readonly requestedKbps: number;
  readonly actualKbps: number;
  readonly savedPercent: number;
  readonly inputBytes: number;
  readonly outputBytes: number;
}

/** Real-time MediaStream recording uses the browser encoder; bitrate is a hint, never a guarantee. */
export async function transcodeAudio424(
  sourceFile: File, requestedMime: AudioFormat424["mime"], requestedKbps: number, signal: AbortSignal,
): Promise<TranscodedAudio424> {
  const requestedBps = validateAudioTarget424(requestedKbps);
  if (!AUDIO_424_FORMATS.some(({ mime }) => mime === requestedMime) ||
      typeof MediaRecorder === "undefined" ||
      !availableAudioFormats424((mime) => MediaRecorder.isTypeSupported(mime)).some(({ mime }) => mime === requestedMime)) {
    throw new Error("AUDIO_424_ENCODER_UNSUPPORTED: il browser non può esportare il formato richiesto.");
  }
  if (signal.aborted) throw new DOMException("Conversione annullata", "AbortError");
  if (!sourceFile || sourceFile.size < 64 || sourceFile.size > AUDIO_424_MAX_INPUT_BYTES) {
    throw new Error("AUDIO_424_INPUT_LIMIT: file audio fino a 12 MiB.");
  }
  if (typeof AudioContext === "undefined") throw new Error("AUDIO_424_DECODER_UNSUPPORTED");
  const context = new AudioContext();
  let recorder: MediaRecorder | null = null;
  let playback: AudioBufferSourceNode | null = null;
  let stream: MediaStream | null = null;
  try {
    const inputBytes = await sourceFile.arrayBuffer();
    if (signal.aborted) throw new DOMException("Conversione annullata", "AbortError");
    let decoded: AudioBuffer;
    try { decoded = await boundedStage424(context.decodeAudioData(inputBytes), signal, 30_000); }
    catch (error) {
      if (signal.aborted || (error instanceof Error && error.message === "AUDIO_424_TIMEOUT")) throw error;
      throw new Error("AUDIO_424_DECODE_UNSUPPORTED: il file audio non è decodificabile.");
    }
    if (!Number.isFinite(decoded.duration) || decoded.duration < 0.15 || decoded.duration > MAX_SECONDS ||
        decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2) {
      throw new Error("AUDIO_424_DURATION_LIMIT: da 0,15 a 60 secondi mono/stereo.");
    }
    if (signal.aborted) throw new DOMException("Conversione annullata", "AbortError");
    await boundedStage424(context.resume(), signal, 10_000);
    if (context.state !== "running") throw new Error("AUDIO_424_AUDIO_SUSPENDED");
    const destination = context.createMediaStreamDestination();
    destination.channelCount = decoded.numberOfChannels;
    stream = destination.stream;
    playback = context.createBufferSource();
    playback.buffer = decoded;
    playback.connect(destination);
    try { recorder = new MediaRecorder(stream, { mimeType: requestedMime, audioBitsPerSecond: requestedBps }); }
    catch { throw new Error("AUDIO_424_ENCODER_UNSUPPORTED: encoder non disponibile per questo formato/bitrate."); }
    const chosen = recorder.mimeType.toLowerCase().split(";")[0]?.trim();
    if (chosen !== requestedMime.split(";")[0]) throw new Error("AUDIO_424_ENCODER_MISMATCH");
    const chunks: Blob[] = [];
    const activeRecorder = recorder;
    const activePlayback = playback;
    const recorded = await new Promise<Blob>((resolve, reject) => {
      let finished = false;
      const timeout = window.setTimeout(() => fail(new Error("AUDIO_424_TIMEOUT")), 70_000);
      const cleanup = () => { window.clearTimeout(timeout); signal.removeEventListener("abort", abort); };
      const fail = (error: Error) => {
        if (finished) return;
        finished = true; cleanup(); reject(error);
      };
      const abort = () => fail(new DOMException("Conversione annullata", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      activeRecorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      activeRecorder.onerror = () => fail(new Error("AUDIO_424_ENCODER_FAILED"));
      activeRecorder.onstop = () => {
        if (finished) return;
        finished = true; cleanup();
        resolve(new Blob(chunks, { type: activeRecorder.mimeType }));
      };
      activePlayback.onended = () => {
        if (activeRecorder.state === "recording") activeRecorder.stop();
      };
      try {
        activeRecorder.start();
        activePlayback.start(context.currentTime + 0.025);
        if (signal.aborted) abort();
      } catch { fail(new Error("AUDIO_424_ENCODER_FAILED")); }
    });
    if (signal.aborted) throw new DOMException("Conversione annullata", "AbortError");
    if (recorded.size > MAX_OUTPUT_BYTES) throw new Error("AUDIO_424_OUTPUT_LIMIT");
    const bytes = new Uint8Array(await recorded.arrayBuffer());
    const { container, codec } = inspectAudioContainer424(bytes, requestedMime);
    const recordedType = recorded.type.toLowerCase().split(";")[0]?.trim();
    if (recordedType !== requestedMime.split(";")[0]) throw new Error("AUDIO_424_CONTAINER_MISMATCH");
    let decodedOutput: AudioBuffer;
    try { decodedOutput = await boundedStage424(context.decodeAudioData(bytes.buffer.slice(0)), signal, 30_000); }
    catch (error) {
      if (signal.aborted || (error instanceof Error && error.message === "AUDIO_424_TIMEOUT")) throw error;
      throw new Error("AUDIO_424_PLAYBACK_UNVERIFIED: l'output non è decodificabile.");
    }
    if (signal.aborted) throw new DOMException("Conversione annullata", "AbortError");
    if (Math.abs(decodedOutput.duration - decoded.duration) > Math.max(0.5, decoded.duration * 0.05)) {
      throw new Error("AUDIO_424_FIDELITY_FAILED: durata di uscita diversa dalla sorgente.");
    }
    const originalEnergy = signalEnergy(decoded);
    const encodedEnergy = signalEnergy(decodedOutput);
    if (originalEnergy > 0.002 && (encodedEnergy < originalEnergy * 0.15 || encodedEnergy > originalEnergy * 3)) {
      throw new Error("AUDIO_424_FIDELITY_FAILED: segnale audio non coerente.");
    }
    return { blob: recorded, mime: requestedMime, container, codec,
      durationSeconds: decodedOutput.duration, requestedKbps,
      inputBytes: sourceFile.size, outputBytes: recorded.size,
      ...measureEncodedAudio424(sourceFile.size, recorded.size, decodedOutput.duration),
    };
  } finally {
    if (recorder?.state === "recording") { try { recorder.stop(); } catch { /* closed */ } }
    if (playback) { playback.onended = null; try { playback.stop(); } catch { /* ended */ } playback.disconnect(); }
    stream?.getTracks().forEach((track) => track.stop());
    await context.close().catch(() => undefined);
  }
}
