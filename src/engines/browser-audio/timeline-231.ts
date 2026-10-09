/** #231: conservative, bounded PCM16 WAV timeline. No lossy transcoding or resampling.
 *
 * Input is decoded per sample from signed 16-bit little-endian PCM. Ranges are
 * [startFrame, endFrame) in the source's native sample clock; the ordered edit
 * list is the output timeline. Cuts do not crossfade and may produce clicks.
 * This module is an isolated DSP proof, not an approved public codec matrix.
 */

export const AUDIO_231_MAX_INPUT_BYTES = 12 * 1024 * 1024;
export const AUDIO_231_MAX_TOTAL_INPUT_BYTES = 24 * 1024 * 1024;
export const AUDIO_231_MAX_OUTPUT_BYTES = 12 * 1024 * 1024;
export const AUDIO_231_MAX_FRAMES = 48_000 * 60;

const MAX_SOURCES = 8;
const MAX_EDITS = 128;
const HEADER_BYTES = 44;

export interface AudioTimelineEdit231 {
  readonly sourceIndex: number;
  readonly startFrame: number;
  readonly endFrame: number;
  /** Linear amplitude: 0 = mute, 1 = unchanged, up to 4 if no sample clips. */
  readonly gain: number;
  /** Linear endpoint fades; 0 disables, otherwise at least 2 frames. */
  readonly fadeInFrames: number;
  readonly fadeOutFrames: number;
}

export interface AudioTimelinePlan231 {
  readonly sampleRate: number;
  readonly channelCount: 1 | 2;
  readonly sourceFrames: readonly number[];
  readonly outputFrames: number;
  readonly durationSeconds: number;
  readonly outputBytes: number;
  readonly edits: readonly AudioTimelineEdit231[];
  readonly format: "RIFF/WAVE PCM signed 16-bit LE";
  readonly caveat: string;
}

export interface AudioTimelineRender231 {
  readonly wav: Uint8Array;
  readonly plan: AudioTimelinePlan231;
}

interface Source {
  readonly bytes: Uint8Array;
  readonly dataStart: number;
  readonly frames: number;
  readonly rate: number;
  readonly channels: 1 | 2;
}

function invalid(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Audio edit cancelled", "AbortError");
}

function fourcc(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
}

function parsePcm16Wav(bytes: Uint8Array, signal?: AbortSignal): Source {
  checkAbort(signal);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < HEADER_BYTES || bytes.byteLength > AUDIO_231_MAX_INPUT_BYTES) {
    invalid("AUDIO_231_INPUT_LIMIT", "WAV input must be 44 bytes to 12 MiB");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (fourcc(bytes, 0) !== "RIFF" || fourcc(bytes, 8) !== "WAVE" || view.getUint32(4, true) !== bytes.length - 8) {
    invalid("AUDIO_231_INVALID_RIFF", "Expected exact RIFF/WAVE length (RF64/RIFX unsupported)");
  }
  let foundFmt = false;
  let foundData = false;
  let rate = 0;
  let channels: 1 | 2 = 1;
  let dataStart = 0;
  let dataSize = 0;
  for (let offset = 12; offset < bytes.length;) {
    checkAbort(signal);
    if (offset + 8 > bytes.length) invalid("AUDIO_231_INVALID_CHUNK", "Truncated chunk header");
    const kind = fourcc(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + size;
    const next = end + (size & 1);
    if (!Number.isSafeInteger(next) || next > bytes.length) invalid("AUDIO_231_INVALID_CHUNK", "Chunk runs beyond RIFF bounds");
    if (kind === "fmt ") {
      if (foundFmt || size !== 16) invalid("AUDIO_231_UNSUPPORTED_FORMAT", "Exactly one 16-byte PCM fmt chunk required");
      foundFmt = true;
      const channelCount = view.getUint16(start + 2, true);
      rate = view.getUint32(start + 4, true);
      if (view.getUint16(start, true) !== 1 || (channelCount !== 1 && channelCount !== 2) ||
          !Number.isInteger(rate) || rate < 8_000 || rate > 48_000 ||
          view.getUint16(start + 14, true) !== 16 ||
          view.getUint16(start + 12, true) !== channelCount * 2 ||
          view.getUint32(start + 8, true) !== rate * channelCount * 2) {
        invalid("AUDIO_231_UNSUPPORTED_FORMAT", "Only consistent mono/stereo PCM16 8–48 kHz supported");
      }
      channels = channelCount;
    } else if (kind === "data") {
      if (foundData) invalid("AUDIO_231_INVALID_CHUNK", "Multiple data chunks unsupported");
      foundData = true;
      dataStart = start;
      dataSize = size;
    }
    offset = next;
  }
  if (!foundFmt || !foundData || !dataSize || dataSize % (channels * 2) !== 0) {
    invalid("AUDIO_231_INVALID_WAV", "Missing fmt/data, zero samples or incomplete sample frames");
  }
  const frames = dataSize / (channels * 2);
  if (frames > Math.min(AUDIO_231_MAX_FRAMES, rate * 60)) {
    invalid("AUDIO_231_INPUT_LIMIT", "Input exceeds 60 seconds at its native sample rate");
  }
  return { bytes, dataStart, frames, rate, channels };
}

/** Strict read-only header/chunk inspection, shared by the opt-in #231 UI Worker.
 * The renderer still independently validates every source on execution. */
export function inspectAudioPcm16Source231(bytes: Uint8Array, signal?: AbortSignal): {
  readonly frames: number;
  readonly sampleRate: number;
  readonly channels: 1 | 2;
  readonly durationSeconds: number;
} {
  const source = parsePcm16Wav(bytes, signal);
  return { frames: source.frames, sampleRate: source.rate, channels: source.channels,
    durationSeconds: source.frames / source.rate };
}

function prepare(sources: readonly Uint8Array[], edits: readonly AudioTimelineEdit231[], signal?: AbortSignal): {
  readonly parsed: readonly Source[];
  readonly plan: AudioTimelinePlan231;
} {
  checkAbort(signal);
  if (!Array.isArray(sources) || sources.length === 0 || sources.length > MAX_SOURCES) {
    invalid("AUDIO_231_SOURCE_LIMIT", "Expected 1–8 WAV sources");
  }
  if (!Array.isArray(edits) || edits.length === 0 || edits.length > MAX_EDITS) {
    invalid("AUDIO_231_EDIT_LIMIT", "Expected 1–128 ordered edits");
  }
  let bytes = 0;
  const parsed: Source[] = [];
  for (const source of sources) {
    checkAbort(signal);
    if (!(source instanceof Uint8Array)) invalid("AUDIO_231_INVALID_SOURCE", "Expected Uint8Array WAV bytes");
    bytes += source.byteLength;
    if (bytes > AUDIO_231_MAX_TOTAL_INPUT_BYTES) invalid("AUDIO_231_INPUT_LIMIT", "Total source budget exceeded");
    parsed.push(parsePcm16Wav(source, signal));
  }
  const rate = parsed[0]!.rate;
  const channelCount = parsed[0]!.channels;
  if (parsed.some((source) => source.rate !== rate || source.channels !== channelCount)) {
    invalid("AUDIO_231_LAYOUT_MISMATCH", "Sample rates/channels must match; resampling and remixing unsupported");
  }
  let outputFrames = 0;
  const normalized: AudioTimelineEdit231[] = [];
  for (const edit of edits) {
    checkAbort(signal);
    if (!edit || !Number.isSafeInteger(edit.sourceIndex) || edit.sourceIndex < 0 || edit.sourceIndex >= parsed.length) {
      invalid("AUDIO_231_INVALID_RANGE", "Unknown source index");
    }
    const frames = parsed[edit.sourceIndex]!.frames;
    if (!Number.isSafeInteger(edit.startFrame) || !Number.isSafeInteger(edit.endFrame) ||
        edit.startFrame < 0 || edit.endFrame <= edit.startFrame || edit.endFrame > frames) {
      invalid("AUDIO_231_INVALID_RANGE", "Edit start/end must be in source frame bounds and nonempty");
    }
    const length = edit.endFrame - edit.startFrame;
    if (!Number.isFinite(edit.gain) || edit.gain < 0 || edit.gain > 4) {
      invalid("AUDIO_231_INVALID_GAIN", "Linear amplitude must be finite, 0–4");
    }
    if (![edit.fadeInFrames, edit.fadeOutFrames].every((n) => Number.isSafeInteger(n) && (n === 0 || n >= 2) && n <= length) ||
        edit.fadeInFrames + edit.fadeOutFrames > length) {
      invalid("AUDIO_231_INVALID_FADE", "Fades must have 0 or >=2 frames and cannot overlap");
    }
    outputFrames += length;
    const outputBytes = HEADER_BYTES + outputFrames * channelCount * 2;
    if (outputFrames > Math.min(AUDIO_231_MAX_FRAMES, rate * 60) || outputBytes > AUDIO_231_MAX_OUTPUT_BYTES) {
      invalid("AUDIO_231_OUTPUT_LIMIT", "Output exceeds 60 second / 12 MiB budget");
    }
    normalized.push({ sourceIndex: edit.sourceIndex, startFrame: edit.startFrame, endFrame: edit.endFrame,
      gain: edit.gain, fadeInFrames: edit.fadeInFrames, fadeOutFrames: edit.fadeOutFrames });
  }
  const plan: AudioTimelinePlan231 = {
    sampleRate: rate, channelCount, sourceFrames: parsed.map((source) => source.frames),
    outputFrames, durationSeconds: outputFrames / rate, outputBytes: HEADER_BYTES + outputFrames * channelCount * 2,
    edits: normalized, format: "RIFF/WAVE PCM signed 16-bit LE",
    caveat: "Sample-exact native-rate PCM16 only; no codec conversion, resampling, speed, LUFS normalization, silence removal or click repair. Unverified on physical mobile devices.",
  };
  return { parsed, plan };
}

/** Preview/reconcile exact output duration and constraints before allocating output. */
export function planAudioTimeline231(sources: readonly Uint8Array[], edits: readonly AudioTimelineEdit231[], signal?: AbortSignal): AudioTimelinePlan231 {
  return prepare(sources, edits, signal).plan;
}

function writeTag(bytes: Uint8Array, index: number, tag: string): void {
  for (let i = 0; i < 4; i += 1) bytes[index + i] = tag.charCodeAt(i);
}

/** Synchronous core suitable for a caller-owned terminating worker. */
export function renderAudioTimeline231(
  sources: readonly Uint8Array[], edits: readonly AudioTimelineEdit231[],
  options: { readonly signal?: AbortSignal; readonly onProgress?: (frames: number, totalFrames: number) => void } = {},
): AudioTimelineRender231 {
  const { parsed, plan } = prepare(sources, edits, options.signal);
  checkAbort(options.signal);
  const output = new Uint8Array(plan.outputBytes);
  const header = new DataView(output.buffer);
  writeTag(output, 0, "RIFF"); header.setUint32(4, output.byteLength - 8, true);
  writeTag(output, 8, "WAVE"); writeTag(output, 12, "fmt "); header.setUint32(16, 16, true);
  header.setUint16(20, 1, true); header.setUint16(22, plan.channelCount, true);
  header.setUint32(24, plan.sampleRate, true); header.setUint32(28, plan.sampleRate * plan.channelCount * 2, true);
  header.setUint16(32, plan.channelCount * 2, true); header.setUint16(34, 16, true);
  writeTag(output, 36, "data"); header.setUint32(40, output.byteLength - HEADER_BYTES, true);
  let writtenFrames = 0;
  for (const edit of plan.edits) {
    const source = parsed[edit.sourceIndex]!;
    const input = new DataView(source.bytes.buffer, source.bytes.byteOffset, source.bytes.byteLength);
    const length = edit.endFrame - edit.startFrame;
    for (let frame = 0; frame < length; frame += 1) {
      if ((writtenFrames & 8191) === 0) {
        checkAbort(options.signal);
        options.onProgress?.(writtenFrames, plan.outputFrames);
        checkAbort(options.signal);
      }
      let envelope = edit.gain;
      if (edit.fadeInFrames && frame < edit.fadeInFrames) envelope *= frame / (edit.fadeInFrames - 1);
      if (edit.fadeOutFrames && frame >= length - edit.fadeOutFrames) envelope *= (length - 1 - frame) / (edit.fadeOutFrames - 1);
      for (let channel = 0; channel < plan.channelCount; channel += 1) {
        const position = source.dataStart + ((edit.startFrame + frame) * plan.channelCount + channel) * 2;
        const sample = input.getInt16(position, true) * envelope;
        // Fail before lossy PCM saturation; output has no hidden limiter.
        if (!Number.isFinite(sample) || sample < -32768 || sample > 32767) {
          invalid("AUDIO_231_WOULD_CLIP", "Gain would saturate 16-bit PCM; reduce gain");
        }
        header.setInt16(HEADER_BYTES + (writtenFrames * plan.channelCount + channel) * 2, Math.round(sample), true);
      }
      writtenFrames += 1;
    }
  }
  checkAbort(options.signal);
  options.onProgress?.(writtenFrames, plan.outputFrames);
  checkAbort(options.signal);
  return { wav: output, plan };
}
