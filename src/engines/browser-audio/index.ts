export type NoiseKind = "white" | "pink" | "brown";

export interface AudioGeneratorSettings {
  readonly mode: "tone" | "metronome" | "noise";
  readonly frequencyHz?: number;
  readonly bpm?: number;
  readonly noiseKind?: NoiseKind;
  readonly level: number;
  readonly durationSeconds: number;
}

export interface SpeechControls {
  readonly rate: number;
  readonly pitch: number;
}

export const RECORDER_MIME_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
] as const;

export interface RecordingClock {
  readonly elapsedMs: number;
  readonly activeStartedAtMs: number | null;
}

function bounded(value: number, minimum: number, maximum: number, code: string): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(code);
  return value;
}

export function validateAudioGeneratorSettings(input: AudioGeneratorSettings): AudioGeneratorSettings {
  const level = bounded(input.level, 0, 0.2, "INVALID_AUDIO_LEVEL");
  const durationSeconds = bounded(input.durationSeconds, 0, 3600, "INVALID_AUDIO_DURATION");
  if (input.mode === "tone") {
    if (input.frequencyHz === undefined) throw new Error("TONE_FREQUENCY_REQUIRED");
    return { mode: input.mode, frequencyHz: bounded(input.frequencyHz, 20, 20_000, "INVALID_TONE_FREQUENCY"), level, durationSeconds };
  }
  if (input.mode === "metronome") {
    if (input.bpm === undefined) throw new Error("METRONOME_BPM_REQUIRED");
    return { mode: input.mode, bpm: bounded(input.bpm, 30, 300, "INVALID_METRONOME_BPM"), level, durationSeconds };
  }
  if (input.mode === "noise") {
    if (input.noiseKind !== "white" && input.noiseKind !== "pink" && input.noiseKind !== "brown") throw new Error("INVALID_NOISE_KIND");
    return { mode: input.mode, noiseKind: input.noiseKind, level, durationSeconds };
  }
  throw new Error("INVALID_AUDIO_MODE");
}

export function bpmFromTapTimes(timestampsMs: readonly number[]): number | null {
  const recent = timestampsMs.filter(Number.isFinite).slice(-6);
  if (recent.length < 2) return null;
  const intervals: number[] = [];
  for (let index = 1; index < recent.length; index += 1) {
    const interval = recent[index]! - recent[index - 1]!;
    if (interval >= 200 && interval <= 2000) intervals.push(interval);
  }
  if (intervals.length === 0) return null;
  const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  return Math.round(60_000 / average);
}

export function generateNoiseSamples(kind: NoiseKind, length: number, random: () => number = Math.random): Float32Array {
  if (!Number.isSafeInteger(length) || length < 1 || length > 4_000_000) throw new Error("INVALID_NOISE_LENGTH");
  const output = new Float32Array(length);
  if (kind === "white") {
    for (let index = 0; index < length; index += 1) output[index] = Math.max(-1, Math.min(1, random() * 2 - 1));
    return output;
  }
  if (kind === "brown") {
    let last = 0;
    for (let index = 0; index < length; index += 1) {
      const white = random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      output[index] = Math.max(-1, Math.min(1, last * 3.5));
    }
    return output;
  }
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let index = 0; index < length; index += 1) {
    const white = random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    output[index] = Math.max(-1, Math.min(1, pink * 0.11));
  }
  return output;
}

export function validateSpeechControls(input: SpeechControls): SpeechControls {
  return {
    rate: bounded(input.rate, 0.5, 2, "INVALID_SPEECH_RATE"),
    pitch: bounded(input.pitch, 0.5, 2, "INVALID_SPEECH_PITCH"),
  };
}

export interface VoiceLike {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
  readonly localService?: boolean;
}

export function italianVoices<T extends VoiceLike>(voices: readonly T[]): T[] {
  return voices.filter((voice) => voice.lang.toLowerCase().startsWith("it"));
}

export function chooseSupportedRecorderMimeType(
  isTypeSupported: ((mimeType: string) => boolean) | undefined,
): string | null {
  if (isTypeSupported === undefined) return null;
  for (const mimeType of RECORDER_MIME_PREFERENCES) {
    try {
      if (isTypeSupported(mimeType)) return mimeType;
    } catch {
      // Runtime MIME probing is advisory; a throwing probe is treated as unsupported.
    }
  }
  return null;
}

export function deriveRecordedBlobType(chunks: readonly Blob[], recorderMimeType: string): string {
  const chunkTypes = chunks.map((chunk) => chunk.type.trim()).filter((type) => type !== "");
  if (chunkTypes.length > 0 && chunkTypes.every((type) => type === chunkTypes[0])) return chunkTypes[0]!;
  return recorderMimeType.trim();
}

export function extensionForRecordedMimeType(mimeType: string): "webm" | "ogg" | "mp4" | "wav" | "bin" {
  const normalized = mimeType.toLowerCase().split(";", 1)[0]?.trim();
  if (normalized === "audio/webm") return "webm";
  if (normalized === "audio/ogg") return "ogg";
  if (normalized === "audio/mp4") return "mp4";
  if (normalized === "audio/wav" || normalized === "audio/wave" || normalized === "audio/x-wav") return "wav";
  return "bin";
}

export function rmsAudioLevel(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let squares = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = Number(samples[index]);
    if (!Number.isFinite(value)) return 0;
    squares += value * value;
  }
  return Math.max(0, Math.min(1, Math.sqrt(squares / samples.length)));
}

function recorderNow(nowMs: number): number {
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error("INVALID_RECORDER_TIMESTAMP");
  return nowMs;
}

export function startRecordingClock(nowMs: number): RecordingClock {
  return { elapsedMs: 0, activeStartedAtMs: recorderNow(nowMs) };
}

export function pauseRecordingClock(clock: RecordingClock, nowMs: number): RecordingClock {
  const now = recorderNow(nowMs);
  if (clock.activeStartedAtMs === null) return clock;
  if (now < clock.activeStartedAtMs) throw new Error("NON_MONOTONIC_RECORDER_CLOCK");
  return { elapsedMs: clock.elapsedMs + now - clock.activeStartedAtMs, activeStartedAtMs: null };
}

export function resumeRecordingClock(clock: RecordingClock, nowMs: number): RecordingClock {
  if (clock.activeStartedAtMs !== null) return clock;
  return { elapsedMs: clock.elapsedMs, activeStartedAtMs: recorderNow(nowMs) };
}

export function recordingDurationMs(clock: RecordingClock, nowMs: number): number {
  if (clock.activeStartedAtMs === null) return clock.elapsedMs;
  const now = recorderNow(nowMs);
  if (now < clock.activeStartedAtMs) throw new Error("NON_MONOTONIC_RECORDER_CLOCK");
  return clock.elapsedMs + now - clock.activeStartedAtMs;
}
