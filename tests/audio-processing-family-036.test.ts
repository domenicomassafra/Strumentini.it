import { describe, expect, it } from "vitest";
import { importPcmWav036 } from "../src/engines/browser-audio/wav-convert-036";
import { previewAudioJob036, renderAudioJob231, type AudioPreviewJob036 } from "../src/engines/browser-audio/timeline-worker-231";
import { pcm16Wav231 } from "./fixtures/audio-dsp-231-corpus";

const sampleEncoding = (bits: 8 | 16 | 24 | 32, kind: "pcm" | "float" = "pcm", values: readonly number[] = [0, 0.5, -0.5, 1]): Uint8Array => {
  const input = new Uint8Array(44 + values.length * bits / 8);
  const view = new DataView(input.buffer);
  const label = (at: number, text: string) => [...text].forEach((ch, i) => { input[at + i] = ch.charCodeAt(0); });
  label(0, "RIFF"); view.setUint32(4, input.length - 8, true); label(8, "WAVE");
  label(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, kind === "float" ? 3 : 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 8000 * bits / 8, true);
  view.setUint16(32, bits / 8, true); view.setUint16(34, bits, true);
  label(36, "data"); view.setUint32(40, input.length - 44, true);
  values.forEach((v, i) => {
    const off = 44 + i * bits / 8;
    if (kind === "float") view.setFloat32(off, v, true);
    else if (bits === 8) view.setUint8(off, Math.round((v + 1) * 127.5));
    else if (bits === 16) view.setInt16(off, Math.max(-32768, Math.min(32767, Math.round(v * 32768))), true);
    else if (bits === 24) {
      const sample = Math.max(-8388608, Math.min(8388607, Math.round(v * 8388608)));
      input[off] = sample & 255; input[off + 1] = sample >>> 8 & 255; input[off + 2] = sample >>> 16 & 255;
    } else view.setInt32(off, Math.max(-2147483648, Math.min(2147483647, Math.round(v * 2147483648))), true);
  });
  return input;
};
const samples = (wav: Uint8Array) => Array.from({ length: (wav.length - 44) / 2 }, (_, i) => new DataView(wav.buffer, wav.byteOffset, wav.byteLength).getInt16(44 + i * 2, true));
const job = (sources: Uint8Array[], changes: Partial<AudioPreviewJob036> = {}): AudioPreviewJob036 => ({
  kind: "preview", sources: sources.map((source) => Uint8Array.from(source).buffer), startSeconds: 0,
  endSeconds: null, secondFirst: false, gain: 1, dsp: {}, ...changes,
});

describe("#036 audio processing family strict file conversion/preview", () => {
  it.each([
    [8, "pcm", [0, 0.5, -0.5, 1]],
    [16, "pcm", [0, 0.5, -0.5, 1]],
    [24, "pcm", [0, 0.5, -0.5, 1]],
    [32, "pcm", [0, 0.5, -0.5, 1]],
    [32, "float", [0, 0.5, -0.5, 1]],
  ] as const)("imports actual %i-bit %s WAV PCM/float as fully parsed 16-bit PCM", (bits, kind, values) => {
    const file = sampleEncoding(bits, kind, values);
    const original = file.slice();
    const converted = importPcmWav036(file);
    expect(new DataView(converted.wav.buffer).getUint16(34, true)).toBe(16);
    expect(new DataView(converted.wav.buffer).getUint32(40, true)).toBe(8);
    expect(converted.outputEncoding).toBe("PCM signed 16-bit LE");
    expect(converted.sourceBitrateBps).toBe(8000 * bits);
    const actual = samples(converted.wav);
    expect(actual).toHaveLength(values.length);
    // The 8-bit unsigned source has 256-unit quantization steps in PCM16.
    for (let i = 0; i < values.length; i++) expect(Math.abs(actual[i]! - values[i]! * 32768)).toBeLessThanOrEqual(bits === 8 ? 256 : 129);
    expect(file).toEqual(original);
  });

  it("previews silence spans and exact output budgets before allocating/publishing exported WAV", () => {
    const original = pcm16Wav231([[1000, 1000, 0, 0, 0, 1000, 1000, 1000]]);
    const selected = job([original], { dsp: { silence: { thresholdSample: 0, minimumFrames: 3 } } });
    const preview = previewAudioJob036(selected);
    expect(preview).toMatchObject({ kind: "preview", preview: { removedFrames: 3, outputFrames: 5, outputBytes: 54 } });
    expect("wav" in preview).toBe(false);
    const result = renderAudioJob231({ ...selected, kind: "render" });
    expect(result).toMatchObject({ kind: "done", preview: { removedFrames: 3, outputFrames: 5, outputBytes: 54 } });
    expect(result.wav.byteLength).toBe(preview.preview.outputBytes);
    expect(samples(new Uint8Array(result.wav))).toEqual([1000, 1000, 1000, 1000, 1000]);
    expect(original).toEqual(pcm16Wav231([[1000, 1000, 0, 0, 0, 1000, 1000, 1000]]));
  });

  it("converts 24-bit PCM then trims, merges, and outputs source and destination codec/rate/size", () => {
    const first = sampleEncoding(24, "pcm", [0, .25, .5, .75]);
    const second = sampleEncoding(8, "pcm", [1, 0]);
    const base = job([first, second], { startSeconds: 1 / 8000, endSeconds: 4 / 8000 });
    const rendered = renderAudioJob231({ ...base, kind: "render" });
    expect(rendered.preview.outputFrames).toBe(5);
    expect(rendered.preview.timeline.sampleRate).toBe(8000);
    expect(rendered.sourceFormats.map((source) => source.sourceEncoding)).toEqual(["PCM 24-bit signed WAV", "PCM 8-bit unsigned WAV"]);
    expect(rendered.sourceFormats.map((source) => source.sourceBytes)).toEqual([56, 46]);
    expect(rendered.sourceFormats.every((source) => source.outputEncoding === "PCM signed 16-bit LE")).toBe(true);
    expect(new Uint8Array(rendered.wav).length).toBe(54);
    expect(samples(new Uint8Array(rendered.wav)).slice(0, 3)).toEqual([8192, 16384, 24576]);
  });

  it("refuses opaque/forged sources, floats outside PCM range and unsupported codecs", () => {
    const bad = sampleEncoding(24);
    new DataView(bad.buffer).setUint32(4, 1, true);
    expect(() => importPcmWav036(bad)).toThrow(/AUDIO_231_INVALID_RIFF/u);
    const float = sampleEncoding(32, "float");
    new DataView(float.buffer).setFloat32(44, Number.NaN, true);
    expect(() => importPcmWav036(float)).toThrow(/AUDIO_036_INVALID_FLOAT_SAMPLE/u);
    const unsupported = sampleEncoding(8);
    new DataView(unsupported.buffer).setUint16(20, 6, true);
    expect(() => importPcmWav036(unsupported)).toThrow(/AUDIO_036_UNSUPPORTED_ENCODING/u);
  });

  it("refuses cancelled preview and render while keeping source bytes intact", () => {
    const pcm = sampleEncoding(32, "float", [0, 0.5, -0.5, 1]);
    const abort = new AbortController(); abort.abort();
    expect(() => previewAudioJob036(job([pcm]), abort.signal)).toThrow(/cancelled/u);
    expect(() => renderAudioJob231({ ...job([pcm]), kind: "render" }, abort.signal)).toThrow(/cancelled/u);
  });
});
