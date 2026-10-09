import { describe, expect, it } from "vitest";
import {
  AUDIO_231_MAX_FRAMES, AUDIO_231_MAX_OUTPUT_BYTES,
  planAudioTimeline231, renderAudioTimeline231, type AudioTimelineEdit231,
} from "../src/engines/browser-audio/timeline-231";

function wav(channels: readonly (readonly number[])[], rate = 48_000): Uint8Array {
  const frameCount = channels[0]!.length;
  const out = new Uint8Array(44 + frameCount * channels.length * 2);
  const view = new DataView(out.buffer);
  const ascii = (at: number, tag: string): void => { for (let i = 0; i < 4; i++) out[at + i] = tag.charCodeAt(i); };
  ascii(0, "RIFF"); view.setUint32(4, out.length - 8, true); ascii(8, "WAVE"); ascii(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels.length * 2, true); view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true); ascii(36, "data"); view.setUint32(40, out.length - 44, true);
  for (let i = 0; i < frameCount; i++) {
    for (let ch = 0; ch < channels.length; ch++) view.setInt16(44 + (i * channels.length + ch) * 2, channels[ch]![i]!, true);
  }
  return out;
}

function edit(sourceIndex: number, startFrame: number, endFrame: number, extra: Partial<AudioTimelineEdit231> = {}): AudioTimelineEdit231 {
  return { sourceIndex, startFrame, endFrame, gain: 1, fadeInFrames: 0, fadeOutFrames: 0, ...extra };
}

function samples(wave: Uint8Array, channels = 1): number[][] {
  const view = new DataView(wave.buffer, wave.byteOffset, wave.byteLength);
  const all = Array.from({ length: channels }, () => [] as number[]);
  for (let offset = 44; offset < wave.length; offset += channels * 2) {
    for (let ch = 0; ch < channels; ch++) all[ch]!.push(view.getInt16(offset + ch * 2, true));
  }
  return all;
}

describe("#231 bounded sample-exact PCM16 WAV timeline", () => {
  it("previews full frame duration and renders ordered cuts, stereo gain and endpoint fades", () => {
    const a = wav([[1000, 2000, 3000, 4000, 5000, 6000], [-1000, -2000, -3000, -4000, -5000, -6000]]);
    const b = wav([[100, 200, 300, 400], [1000, 2000, 3000, 4000]]);
    const edits = [edit(1, 1, 4), edit(0, 1, 5, { gain: 0.5, fadeInFrames: 2, fadeOutFrames: 2 })];
    const plan = planAudioTimeline231([a, b], edits);
    expect(plan).toMatchObject({ sampleRate: 48_000, channelCount: 2, sourceFrames: [6, 4], outputFrames: 7,
      outputBytes: 44 + 7 * 4, durationSeconds: 7 / 48_000 });
    expect(plan.edits).toEqual(edits);
    const result = renderAudioTimeline231([a, b], edits);
    expect(result.plan).toEqual(plan);
    expect(samples(result.wav, 2)).toEqual([
      [200, 300, 400, 0, 1500, 2000, 0],
      [2000, 3000, 4000, 0, -1500, -2000, 0],
    ]);
    expect(new TextDecoder().decode(result.wav.subarray(0, 4))).toBe("RIFF");
    expect(new DataView(result.wav.buffer).getUint32(40, true)).toBe(28);
  });

  it("preserves PCM16 exactly for unity gain with subarray input, muted segments and custom ancillary chunks", () => {
    const original = wav([[0, -32768, 32767, 10, -10, -2048, 4096]]);
    // Real WAV headers sometimes include ancillary even-sized chunks.
    const withList = new Uint8Array(original.length + 12);
    withList.set(original.subarray(0, 36));
    withList.set([76, 73, 83, 84, 4, 0, 0, 0, 65, 66, 67, 68], 36);
    withList.set(original.subarray(36), 48);
    new DataView(withList.buffer).setUint32(4, withList.length - 8, true);
    const backing = new Uint8Array(withList.length + 10);
    backing.set(withList, 5);
    const output = renderAudioTimeline231([backing.subarray(5, 5 + withList.length)], [edit(0, 0, 7)]).wav;
    expect(samples(output)[0]).toEqual([0, -32768, 32767, 10, -10, -2048, 4096]);
    expect(samples(renderAudioTimeline231([original], [edit(0, 0, 7, { gain: 0 })]).wav)[0]).toEqual(Array(7).fill(0));
  });

  it("refuses clipped output instead of applying a hidden limiter", () => {
    expect(() => renderAudioTimeline231([wav([[20000, -24000]])], [edit(0, 0, 2, { gain: 2 })]))
      .toThrow(/AUDIO_231_WOULD_CLIP/);
    expect(samples(renderAudioTimeline231([wav([[5000]])], [edit(0, 0, 1, { gain: 2 })]).wav)[0]).toEqual([10000]);
  });

  it("refuses out-of-range trims, missing source, bad fades, bad gains, and rate/channel mismatches", () => {
    const one = wav([[1, 2, 3, 4]]);
    for (const bad of [edit(0, 0, 5), edit(0, -1, 2), edit(0, 4, 4), edit(2, 0, 1), edit(0, 0.5, 2)]) {
      expect(() => planAudioTimeline231([one], [bad])).toThrow(/AUDIO_231_INVALID_RANGE/);
    }
    for (const bad of [edit(0, 0, 4, { fadeInFrames: 1 }), edit(0, 0, 4, { fadeInFrames: 3, fadeOutFrames: 2 })]) {
      expect(() => planAudioTimeline231([one], [bad])).toThrow(/AUDIO_231_INVALID_FADE/);
    }
    for (const gain of [NaN, Infinity, -1, 4.01]) {
      expect(() => planAudioTimeline231([one], [edit(0, 0, 4, { gain })])).toThrow(/AUDIO_231_INVALID_GAIN/);
    }
    expect(() => planAudioTimeline231([one, wav([[1, 2]], 44_100)], [edit(0, 0, 1)]))
      .toThrow(/AUDIO_231_LAYOUT_MISMATCH/);
    expect(() => planAudioTimeline231([one, wav([[1], [2]])], [edit(0, 0, 1)]))
      .toThrow(/AUDIO_231_LAYOUT_MISMATCH/);
  });

  it("rejects corrupt headers, compressed/float variants, inconsistent RIFF/data sizes, zero frames and overbudget output", () => {
    const good = wav([[1, 2, 3, 4]]);
    const mutate = (at: number, value: number): Uint8Array => {
      const changed = good.slice(); changed[at] = value; return changed;
    };
    expect(() => renderAudioTimeline231([mutate(0, 0)], [edit(0, 0, 2)])).toThrow(/INVALID_RIFF/);
    expect(() => renderAudioTimeline231([mutate(20, 3)], [edit(0, 0, 2)])).toThrow(/UNSUPPORTED_FORMAT/);
    expect(() => renderAudioTimeline231([mutate(34, 32)], [edit(0, 0, 2)])).toThrow(/UNSUPPORTED_FORMAT/);
    expect(() => renderAudioTimeline231([mutate(40, 255)], [edit(0, 0, 2)])).toThrow(/INVALID_CHUNK/);
    expect(() => renderAudioTimeline231([good.subarray(0, good.length - 1)], [edit(0, 0, 2)])).toThrow(/INVALID_RIFF/);
    expect(() => renderAudioTimeline231([good], [edit(0, 0, 4), ...Array(127).fill(edit(0, 0, 4))])).not.toThrow();
    const long = wav([Array(48_000).fill(1)]);
    const many = Array.from({ length: 128 }, () => edit(0, 0, 48_000));
    expect(() => planAudioTimeline231([long], many)).toThrow(/AUDIO_231_OUTPUT_LIMIT/);
    const slow = wav([Array(8000 * 61).fill(1)], 8000);
    expect(() => planAudioTimeline231([slow], [edit(0, 0, 8000)])).toThrow(/AUDIO_231_INPUT_LIMIT/);
    const slowMinute = wav([Array(8000 * 60).fill(1)], 8000);
    expect(planAudioTimeline231([slowMinute], [edit(0, 0, 8000 * 60)]).outputFrames).toBe(8000 * 60);
    expect(AUDIO_231_MAX_FRAMES).toBe(2_880_000);
    expect(AUDIO_231_MAX_OUTPUT_BYTES).toBe(12 * 1024 * 1024);
  });

  it("honours cancellation before allocation and between rendering chunks", () => {
    const input = wav([Array(48_000).fill(300)]);
    const abort = new AbortController(); abort.abort();
    expect(() => planAudioTimeline231([input], [edit(0, 0, 48_000)], abort.signal)).toThrowError(expect.objectContaining({ name: "AbortError" }));
    expect(() => renderAudioTimeline231([input], [edit(0, 0, 48_000)], { signal: abort.signal })).toThrowError(expect.objectContaining({ name: "AbortError" }));
    const working = new AbortController();
    const progress: number[] = [];
    expect(() => renderAudioTimeline231([input], [edit(0, 0, 48_000)], {
      signal: working.signal,
      onProgress: (frames) => { progress.push(frames); if (frames >= 8192) working.abort(); },
    })).toThrowError(expect.objectContaining({ name: "AbortError" }));
    expect(progress).toEqual([0, 8192]);
  });
});
