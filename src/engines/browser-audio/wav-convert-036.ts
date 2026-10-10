/** #036 bounded lossless-container WAV PCM import into the existing PCM16 timeline.
 * PCM 8/24/32 and IEEE float32 are converted by explicitly disclosed sample
 * quantization. No codec, pitch-preserving conversion or file upload exists.
 */
import { AUDIO_231_MAX_INPUT_BYTES, AUDIO_231_MAX_OUTPUT_BYTES } from "./timeline-231";

export interface PcmImport036 {
  readonly wav: Uint8Array;
  readonly sourceBytes: number;
  readonly sourceEncoding: string;
  readonly sampleRate: number;
  readonly channels: number;
  readonly sourceBitrateBps: number;
  readonly sourceDurationSeconds: number;
  readonly convertedBytes: number;
  readonly outputEncoding: "PCM signed 16-bit LE";
}

function fail(reason: string): never { throw new Error(`AUDIO_036_${reason}`); }
function check(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Audio import cancelled", "AbortError");
}
function tag(bytes: Uint8Array, pos: number): string {
  return String.fromCharCode(bytes[pos]!, bytes[pos + 1]!, bytes[pos + 2]!, bytes[pos + 3]!);
}
function writeTag(bytes: Uint8Array, pos: number, value: string): void {
  for (let i = 0; i < 4; i++) bytes[pos + i] = value.charCodeAt(i);
}

/** Validates the complete RIFF/chunk envelope; never trusts a filename or MIME claim. */
export function importPcmWav036(source: Uint8Array, signal?: AbortSignal): PcmImport036 {
  check(signal);
  if (!(source instanceof Uint8Array) || source.byteLength < 44 || source.byteLength > AUDIO_231_MAX_INPUT_BYTES) fail("SOURCE_LIMIT");
  const input = new DataView(source.buffer, source.byteOffset, source.byteLength);
  if (tag(source, 0) !== "RIFF" || tag(source, 8) !== "WAVE" || input.getUint32(4, true) + 8 !== source.byteLength) {
    // Preserve the original 231 rejection contract for callers of its Worker.
    throw new Error("AUDIO_231_INVALID_RIFF: WAV RIFF header/length mismatch");
  }

  let offset = 12;
  let fmt: { codec: number; rate: number; channels: number; bits: number; align: number; byteRate: number } | null = null;
  let dataStart = -1;
  let dataLength = -1;
  let chunkCount = 0;
  while (offset < source.byteLength) {
    if (++chunkCount > 128 || offset + 8 > source.byteLength) fail("CHUNK_LIMIT");
    const size = input.getUint32(offset + 4, true);
    const end = offset + 8 + size;
    if (!Number.isSafeInteger(end) || end > source.byteLength || end + (size % 2) > source.byteLength) fail("CHUNK_BOUNDS");
    const type = tag(source, offset);
    if (type === "fmt ") {
      if (fmt !== null || size !== 16) fail("UNSUPPORTED_FMT");
      fmt = {
        codec: input.getUint16(offset + 8, true),
        channels: input.getUint16(offset + 10, true),
        rate: input.getUint32(offset + 12, true),
        byteRate: input.getUint32(offset + 16, true),
        align: input.getUint16(offset + 20, true),
        bits: input.getUint16(offset + 22, true),
      };
    } else if (type === "data") {
      if (dataStart !== -1) fail("MULTIPLE_DATA");
      dataStart = offset + 8;
      dataLength = size;
    } else if (type !== "JUNK" && type !== "LIST" && type !== "PAD " && type !== "fact") {
      // Refuse unknown extension formats or auxiliary audio payloads instead
      // of silently deleting them from a supposedly faithful conversion.
      fail("UNSUPPORTED_CHUNK");
    }
    offset = end + (size % 2);
  }
  if (fmt === null || dataStart < 0 || dataLength <= 0 || offset !== source.byteLength) fail("INCOMPLETE_WAV");
  const { codec, channels, rate, bits, align, byteRate } = fmt;
  const isPcm = codec === 1 && [8, 16, 24, 32].includes(bits);
  const isFloat = codec === 3 && bits === 32;
  if ((!isPcm && !isFloat) || ![1, 2].includes(channels) || rate < 8000 || rate > 48000 ||
      align !== channels * bits / 8 || byteRate !== rate * align || dataLength % align !== 0) fail("UNSUPPORTED_ENCODING");
  const frames = dataLength / align;
  if (frames < 1 || frames > rate * 60) fail("DURATION_LIMIT");
  const outputBytes = 44 + frames * channels * 2;
  if (outputBytes > AUDIO_231_MAX_OUTPUT_BYTES) fail("OUTPUT_LIMIT");
  check(signal);

  const output = new Uint8Array(outputBytes);
  const view = new DataView(output.buffer);
  writeTag(output, 0, "RIFF"); view.setUint32(4, outputBytes - 8, true);
  writeTag(output, 8, "WAVE"); writeTag(output, 12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  writeTag(output, 36, "data"); view.setUint32(40, outputBytes - 44, true);
  const samples = frames * channels;
  for (let index = 0; index < samples; index++) {
    if ((index & 8191) === 0) check(signal);
    const at = dataStart + index * (bits / 8);
    let sample: number;
    if (isFloat) {
      const float = input.getFloat32(at, true);
      if (!Number.isFinite(float) || float < -1 || float > 1) fail("INVALID_FLOAT_SAMPLE");
      sample = Math.round(float < 0 ? float * 32768 : float * 32767);
    } else if (bits === 8) sample = (source[at]! - 128) * 256;
    else if (bits === 16) sample = input.getInt16(at, true);
    else if (bits === 24) {
      const value = source[at]! | (source[at + 1]! << 8) | (source[at + 2]! << 16);
      sample = Math.round((value & 0x800000 ? value - 0x1000000 : value) / 256);
    } else sample = Math.round(input.getInt32(at, true) / 65536);
    view.setInt16(44 + index * 2, Math.max(-32768, Math.min(32767, sample)), true);
  }
  check(signal);
  return {
    wav: output, sourceBytes: source.byteLength,
    sourceEncoding: isFloat ? "IEEE float32 WAV" : `PCM ${bits}-bit ${bits === 8 ? "unsigned" : "signed"} WAV`,
    sampleRate: rate, channels, sourceBitrateBps: byteRate * 8,
    sourceDurationSeconds: frames / rate, convertedBytes: outputBytes,
    outputEncoding: "PCM signed 16-bit LE",
  };
}
