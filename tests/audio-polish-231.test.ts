import { describe, expect, it } from "vitest";
import { pcm16Wav231 } from "./fixtures/audio-dsp-231-corpus";
import { renderAudioTimelineDsp231 } from "../src/engines/browser-audio/timeline-dsp-231";
import { renderAudioTimelinePolish231, previewAudioTimelinePolish231 } from "../src/engines/browser-audio/timeline-polish-231";
import type { AudioTimelineEdit231 } from "../src/engines/browser-audio/timeline-231";

const edit = (frames: number, sourceIndex = 0): AudioTimelineEdit231 => ({
  sourceIndex, startFrame: 0, endFrame: frames, gain: 1, fadeInFrames: 0, fadeOutFrames: 0,
});

function channels(wav: Uint8Array): number[][] {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe("RIFF");
  expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe("WAVE");
  expect(view.getUint16(20, true)).toBe(1); // PCM
  expect(view.getUint16(34, true)).toBe(16);
  expect(view.getUint32(4, true)).toBe(wav.length - 8);
  expect(view.getUint32(40, true)).toBe(wav.length - 44);
  const count = view.getUint16(22, true);
  const frames = view.getUint32(40, true) / (count * 2);
  return Array.from({ length: count }, (_, ch) => Array.from({ length: frames }, (_, frame) =>
    view.getInt16(44 + (frame * count + ch) * 2, true)));
}

describe("#231 isolated PCM16 anti-click polish and measured RMS gain, composing existing speed/silence", () => {
  it("removes source silence with existing engine then fades an actual hard join to zero without changing WAV duration", () => {
    const wav = pcm16Wav231([[10000, 10000, 10000, 10000, 0, 0, 0, 0, -10000, -10000, -10000, -10000]]);
    const before = wav.slice();
    const dsp = { silence: { thresholdSample: 0, minimumFrames: 4 } };
    const result = renderAudioTimelinePolish231([wav], [edit(12)], dsp, { declick: { windowFrames: 2 } });
    expect(channels(result.wav)).toEqual([[10000, 10000, 10000, 0, 0, -10000, -10000, -10000]]);
    expect(result.preview).toMatchObject({ outputFrames: 8, softenedJoins: [4], removedFrames: 4,
      rmsGain: 1, smoothing: "zero-amplitude-dip", normalization: "disabled", wavVerified: true });
    expect(result.preview.rmsBefore).toBeCloseTo(10000 * Math.sqrt(6 / 8), 4);
    expect(result.preview.rmsAfter).toBeCloseTo(10000 * Math.sqrt(6 / 8), 4);
    expect(wav).toEqual(before); // no mutation of any caller-provided source
    expect(previewAudioTimelinePolish231([wav], [edit(12)], dsp, { declick: { windowFrames: 2 } })).toEqual(result.preview);
  });

  it("runs RMS normalization after declick, reports measured (not promised) RMS and preserves linked stereo phase", () => {
    const wav = pcm16Wav231([
      [10000, 10000, 10000, 10000, 0, 0, 0, 0, -10000, -10000, -10000, -10000],
      [-5000, -5000, -5000, -5000, 0, 0, 0, 0, 5000, 5000, 5000, 5000],
    ]);
    const result = renderAudioTimelinePolish231([wav], [edit(12)],
      { silence: { thresholdSample: 0, minimumFrames: 4 } },
      { declick: { windowFrames: 2 }, rmsNormalize: { targetRmsSample: 9500 } });
    const [left, right] = channels(result.wav);
    expect(left).toHaveLength(8);
    expect(result.preview).toMatchObject({ outputFrames: 8, removedFrames: 4, softenedJoins: [4],
      normalization: "sample-rms", smoothing: "zero-amplitude-dip", wavVerified: true });
    expect(result.preview.rmsBefore).toBeGreaterThan(0);
    expect(result.preview.rmsGain).toBeGreaterThan(1);
    expect(result.preview.rmsAfter).toBeCloseTo(9500, 0);
    for (let i = 0; i < left!.length; i++) expect(Math.abs(left![i]! + 2 * right![i]!)).toBeLessThanOrEqual(1);
    expect(result.preview.samplePeakAfter).toBeLessThanOrEqual(32767);
  });

  it("reuses actual edit-boundaries even without silence removal; no declick leaves legacy output byte-identical", () => {
    const first = pcm16Wav231([[10000, 10000, 10000, 10000]]);
    const second = pcm16Wav231([[-10000, -10000, -10000, -10000]]);
    const edits = [edit(4, 0), edit(4, 1)];
    const expected = renderAudioTimelineDsp231([first, second], edits, {});
    const unmodified = renderAudioTimelinePolish231([first, second], edits, {}, {});
    expect(unmodified.wav).toEqual(expected.wav);
    const softened = renderAudioTimelinePolish231([first, second], edits, {}, { declick: { windowFrames: 2 } });
    expect(channels(softened.wav)).toEqual([[10000, 10000, 10000, 0, 0, -10000, -10000, -10000]]);
    expect(softened.preview.softenedJoins).toEqual([4]);
  });

  it("does not replace real pitch-changing speed: composes native varispeed and measured RMS", () => {
    const wav = pcm16Wav231([[2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000]]);
    const base = renderAudioTimelineDsp231([wav], [edit(8)], { speed: { ratio: 2 } });
    const result = renderAudioTimelinePolish231([wav], [edit(8)], { speed: { ratio: 2 } }, { rmsNormalize: { targetRmsSample: 10000 } });
    expect(result.preview.base.speedRatio).toBe(2);
    expect(result.preview.outputFrames).toBe(4);
    expect(result.preview.softenedJoins).toEqual([]);
    expect(result.wav.byteLength).toBe(base.wav.byteLength);
    expect(result.preview.rmsAfter).toBeCloseTo(10000, 0);
    expect(() => renderAudioTimelinePolish231([wav], [edit(8)], { speed: { ratio: 2 } }, { declick: { windowFrames: 2 } }))
      .toThrow(/AUDIO_231_POLISH_SPEED_MAPPING/);
    const plain = renderAudioTimelinePolish231([wav], [edit(8)], { speed: { ratio: 2 } }, {});
    expect(plain.wav).toEqual(base.wav);
  });

  it("rejects fades reaching outside audio or overlapping nearby joins rather than corrupting samples", () => {
    const edge = pcm16Wav231([[1000]]);
    const mid = pcm16Wav231([[-1000, -1000, -1000, -1000]]);
    expect(() => renderAudioTimelinePolish231([edge, mid], [edit(1), edit(4, 1)], {}, { declick: { windowFrames: 2 } }))
      .toThrow(/AUDIO_231_POLISH_JOIN_BOUNDS/);
    const first = pcm16Wav231([[1000, 1000, 1000, 1000]]);
    const third = pcm16Wav231([[500, 500, 500, 500]]);
    expect(() => renderAudioTimelinePolish231([first, mid, third], [edit(4), edit(4, 1), edit(4, 2)], {}, { declick: { windowFrames: 3 } }))
      .toThrow(/AUDIO_231_POLISH_JOIN_BOUNDS/);
  });

  it("attenuates legal -32768 PCM16 extrema without falsely treating the negative endpoint as clipping", () => {
    const wav = pcm16Wav231([[-32768, 0, 0, 0]]);
    const result = renderAudioTimelinePolish231([wav], [edit(4)], {}, { rmsNormalize: { targetRmsSample: 8192 } });
    expect(channels(result.wav)).toEqual([[-16384, 0, 0, 0]]);
    expect(result.preview).toMatchObject({ rmsAfter: 8192, samplePeakAfter: 16384, rmsGain: 0.5 });
  });

  it("refuses invalid settings, impossible dip joins, empty RMS, clipping, gain >4, overlapping effects and cancellation", () => {
    const quiet = pcm16Wav231([[0, 0, 0, 0]]);
    const loud = pcm16Wav231([[25000, 0, 0, 0]]);
    const tiny = pcm16Wav231([[100, 100, 100, 100]]);
    const call = (source: Uint8Array, polish: unknown, dsp: unknown = {}) =>
      renderAudioTimelinePolish231([source], [edit(4)], dsp as never, polish as never);
    for (const polish of [null, { nonsense: true }, { declick: { windowFrames: 0 } },
      { declick: { windowFrames: 4097 } }, { declick: { windowFrames: 1.5 } },
      { declick: { windowFrames: 2, crossfade: true } },
      { rmsNormalize: { targetRmsSample: 0 } }, { rmsNormalize: { targetRmsSample: 32768 } },
      { rmsNormalize: { targetRmsSample: NaN } }]) {
      expect(() => call(tiny, polish), String(polish)).toThrow(/AUDIO_231_POLISH_INVALID/);
    }
    expect(() => call(quiet, { rmsNormalize: { targetRmsSample: 1000 } })).toThrow(/AUDIO_231_POLISH_SILENCE/);
    expect(() => call(tiny, { rmsNormalize: { targetRmsSample: 1000 } })).toThrow(/AUDIO_231_POLISH_GAIN_LIMIT/);
    expect(() => call(loud, { rmsNormalize: { targetRmsSample: 24000 } })).toThrow(/AUDIO_231_POLISH_WOULD_CLIP/);
    expect(() => call(tiny, { rmsNormalize: { targetRmsSample: 100 } }, { normalize: { targetPeakSample: 200 } }))
      .toThrow(/AUDIO_231_POLISH_CONFLICT/);
    const abort = new AbortController(); abort.abort();
    expect(() => renderAudioTimelinePolish231([tiny], [edit(4)], {}, {}, abort.signal)).toThrow(/AbortError|aborted/);
  });
});
