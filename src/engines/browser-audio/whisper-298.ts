/** Strict bounded RIFF/PCM16 decoder for the opt-in Whisper demonstration. */
export const WHISPER_298_MODEL = "Xenova/whisper-tiny";
export const WHISPER_298_REVISION = "5332fcc35e32a33b86612b9a57a89be7906102b1";
export const WHISPER_298_MAX_BYTES = 12 * 1024 * 1024;
export const WHISPER_298_MAX_SECONDS = 30;
export const WHISPER_298_HZ = 16000;

export class Whisper298Error extends Error {
  constructor(public readonly code: string) { super(code); this.name = "Whisper298Error"; }
}

export function preflightWhisper298(bytes: number, memoryGB?: number): void {
  if (!Number.isFinite(bytes) || bytes < 44 || bytes > WHISPER_298_MAX_BYTES) throw new Whisper298Error("AUDIO_SIZE_LIMIT");
  if (memoryGB !== undefined && memoryGB > 0 && memoryGB < 4) throw new Whisper298Error("MEMORY_LIMIT");
}

/** Accepts valid RIFF WAVE PCM16 mono/stereo, 8–48 kHz, duration 0.2–30 s. */
export function decodeWavForWhisper298(buffer: ArrayBuffer): Float32Array {
  preflightWhisper298(buffer.byteLength);
  const view = new DataView(buffer);
  const ascii = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4));
  if (ascii(0) !== "RIFF" || ascii(8) !== "WAVE" || view.getUint32(4, true) + 8 !== buffer.byteLength) {
    throw new Whisper298Error("AUDIO_UNSUPPORTED_FORMAT");
  }
  let channels = 0, sampleRate = 0, dataAt = -1, dataBytes = 0, blockAlign = 0;
  let foundFmt = false;
  for (let at = 12; at + 8 <= buffer.byteLength;) {
    const name = ascii(at);
    const length = view.getUint32(at + 4, true);
    const end = at + 8 + length;
    if (end > buffer.byteLength || end + (length & 1) > buffer.byteLength) throw new Whisper298Error("AUDIO_CORRUPT");
    if (name === "fmt ") {
      if (foundFmt || length < 16) throw new Whisper298Error("AUDIO_UNSUPPORTED_FORMAT");
      foundFmt = true;
      channels = view.getUint16(at + 10, true);
      sampleRate = view.getUint32(at + 12, true);
      blockAlign = view.getUint16(at + 20, true);
      if (view.getUint16(at + 8, true) !== 1 || ![1, 2].includes(channels)
        || sampleRate < 8000 || sampleRate > 48000 || view.getUint16(at + 22, true) !== 16
        || blockAlign !== channels * 2 || view.getUint32(at + 16, true) !== sampleRate * blockAlign) {
        throw new Whisper298Error("AUDIO_UNSUPPORTED_FORMAT");
      }
    } else if (name === "data") {
      if (dataAt !== -1) throw new Whisper298Error("AUDIO_UNSUPPORTED_FORMAT");
      dataAt = at + 8;
      dataBytes = length;
    }
    at = end + (length & 1);
  }
  if (!foundFmt || dataAt < 0 || !dataBytes || dataBytes % blockAlign !== 0) throw new Whisper298Error("AUDIO_CORRUPT");
  const frames = dataBytes / blockAlign;
  const seconds = frames / sampleRate;
  if (seconds < 0.2 || seconds > WHISPER_298_MAX_SECONDS) throw new Whisper298Error("AUDIO_DURATION_LIMIT");
  const output = new Float32Array(Math.round(seconds * WHISPER_298_HZ));
  // Interpolate only between bounded source samples; downmix stereo to mono.
  const source = (frame: number) => {
    const offset = dataAt + Math.min(frames - 1, Math.max(0, frame)) * blockAlign;
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) sum += view.getInt16(offset + channel * 2, true) / 32768;
    return sum / channels;
  };
  let power = 0;
  for (let i = 0; i < output.length; i++) {
    const position = i * sampleRate / WHISPER_298_HZ;
    const before = Math.floor(position);
    const fraction = position - before;
    const value = source(before) * (1 - fraction) + source(before + 1) * fraction;
    output[i] = value;
    power += value * value;
  }
  if (Math.sqrt(power / output.length) < 0.001) throw new Whisper298Error("AUDIO_SILENCE");
  return output;
}
