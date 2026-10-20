import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decodeWavForWhisper298, preflightWhisper298, WHISPER_298_HZ, WHISPER_298_MAX_BYTES,
  WHISPER_298_MAX_SECONDS, WHISPER_298_MODEL, WHISPER_298_REVISION,
} from "../src/engines/browser-audio/whisper-298";

const corpus = readFileSync(new URL("./fixtures/whisper-298/italian-minds14-1.wav", import.meta.url));
const asBuffer = (bytes: Uint8Array) => Uint8Array.from(bytes).buffer;

describe("#298 — opt-in transcription, real Italian speech corpus", () => {
  it("decodes an actual 8 kHz Italian spoken sentence and resamples to 16 kHz", () => {
    // Independent reference: PolyAI MINDS-14, it-IT/train, index 1, CC-BY-4.0.
    // Truth: 'Buongiorno Vorrei depositare denaro sul mio conto corrente Come devo fare per cortesia'.
    const output = decodeWavForWhisper298(asBuffer(corpus));
    expect(output.length).toBe(Math.round(8.42 * WHISPER_298_HZ));
    expect(Math.max(...output.subarray(0, 250))).toBeLessThanOrEqual(1);
    expect(output.some((value) => Math.abs(value) > 0.01)).toBe(true);
  });

  it("uses a bounded multilingual revision with explicit file/memory/duration limits", () => {
    expect(WHISPER_298_MODEL).toBe("Xenova/whisper-tiny");
    expect(WHISPER_298_REVISION).toMatch(/^[a-f0-9]{40}$/u);
    expect(WHISPER_298_MAX_SECONDS).toBe(30);
    expect(() => preflightWhisper298(WHISPER_298_MAX_BYTES + 1)).toThrow(/AUDIO_SIZE_LIMIT/u);
    expect(() => preflightWhisper298(1024, 2)).toThrow(/MEMORY_LIMIT/u);
    expect(() => preflightWhisper298(1024, 4)).not.toThrow();
  });

  it("rejects mislabeled payloads, unsupported codecs, truncation, malformed RIFF and silence", () => {
    const good = Uint8Array.from(corpus);
    const corrupt = Uint8Array.from(good);
    corrupt[4] = (corrupt[4] ?? 0) ^ 0x40;
    expect(() => decodeWavForWhisper298(asBuffer(corrupt))).toThrow(/AUDIO_UNSUPPORTED_FORMAT/u);
    const notWav = new Uint8Array(100);
    expect(() => decodeWavForWhisper298(notWav.buffer)).toThrow(/AUDIO_UNSUPPORTED_FORMAT/u);
    const wrongCodec = Uint8Array.from(good);
    wrongCodec[20] = 3;
    expect(() => decodeWavForWhisper298(asBuffer(wrongCodec))).toThrow(/AUDIO_UNSUPPORTED_FORMAT/u);
    const dataChunk = good.indexOf(0x64, 12); // 'data' of the tiny corpus, guard below
    expect(dataChunk).toBeGreaterThanOrEqual(12);
    const silence = Uint8Array.from(good);
    const dataStart = new TextDecoder("ascii").decode(silence).indexOf("data");
    const length = new DataView(silence.buffer).getUint32(dataStart + 4, true);
    silence.fill(0, dataStart + 8, dataStart + 8 + length);
    expect(() => decodeWavForWhisper298(asBuffer(silence))).toThrow(/AUDIO_SILENCE/u);
    const truncated = Uint8Array.from(good.subarray(0, good.length - 4));
    expect(() => decodeWavForWhisper298(asBuffer(truncated))).toThrow(/AUDIO_UNSUPPORTED_FORMAT/u);
  });
});
