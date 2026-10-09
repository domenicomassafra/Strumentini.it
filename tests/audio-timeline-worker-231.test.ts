import { describe, expect, it } from "vitest";
import { renderAudioJob231, waveformPeaks231, type AudioJob231 } from "../src/engines/browser-audio/timeline-worker-231";
import { pcm16Wav231 } from "./fixtures/audio-dsp-231-corpus";

const pcm = (samples: readonly number[], rate = 8000) => pcm16Wav231([samples], rate).buffer as ArrayBuffer;
const base = (sources: ArrayBuffer[], changes: Partial<AudioJob231> = {}): AudioJob231 => ({
  kind: "render", sources, startSeconds: 0, endSeconds: null, secondFirst: false,
  gain: 1, dsp: {}, ...changes,
});
const values = (wav: ArrayBuffer) => {
  const view = new DataView(wav);
  return Array.from({ length: (wav.byteLength - 44) / 2 }, (_, i) => view.getInt16(44 + i * 2, true));
};

describe("#231 dedicated Worker protocol and real-output waveform", () => {
  it("returns verifiable WAV and peaks from real edited samples, never a synthetic curve", () => {
    const job = base([pcm([0, 1000, 2000, -4000])], { startSeconds: 1 / 8000, endSeconds: 4 / 8000 });
    const result = renderAudioJob231(job);
    expect(result).toMatchObject({ kind: "done", preview: { timeline: { sampleRate: 8000 } } });
    expect(result.preview).toMatchObject({ outputFrames: 3, outputBytes: 50, sourceTimelineFrames: 3 });
    expect(values(result.wav)).toEqual([1000, 2000, -4000]);
    expect(result.peaks.length).toBe(192);
    expect(result.peaks.filter((v) => v !== 0)).toHaveLength(3);
    expect(Math.max(...result.peaks)).toBeCloseTo(4000 / 32768, 8);
  });

  it("reorders and concatenates two genuine compatible WAVs then normalizes and speeds up", () => {
    const result = renderAudioJob231(base([pcm([1000, 2000, 3000, 4000]), pcm([-1000, -2000, -3000, -4000])], {
      secondFirst: true, gain: 1, dsp: { speed: { ratio: 2 }, normalize: { targetPeakSample: 10000 } },
    }));
    expect(result.preview).toMatchObject({ sourceTimelineFrames: 8, outputFrames: 4, outputPeakSample: 10000,
      speedRatio: 2, speedProcessing: "linear-varispeed-pitch-changes" });
    expect(values(result.wav)).toEqual([-4286, -10000, 4286, 10000]);
  });

  it("checks unchanged 1x and only the first WAV's trim when appending another source", () => {
    const result = renderAudioJob231(base([pcm([1, 2, 3, 4]), pcm([5, 6])], {
      startSeconds: 2 / 8000, endSeconds: 4 / 8000,
    }));
    expect(values(result.wav)).toEqual([3, 4, 5, 6]);
    expect(result.preview.timeline.edits.map(({ sourceIndex }) => sourceIndex)).toEqual([0, 1]);
  });

  it.each([
    { startSeconds: -1 }, { startSeconds: Number.NaN }, { endSeconds: 100 },
    { startSeconds: 0.1, endSeconds: 0.2 }, { gain: 6 }, { gain: Number.POSITIVE_INFINITY },
    { secondFirst: true }, { secondFirst: "true" },
  ])("refuses invalid request boundaries or schema without output: %j", (change) => {
    expect(() => renderAudioJob231(base([pcm([100, 200, 300, 400])], change as Partial<AudioJob231>)))
      .toThrow(/AUDIO_231_/u);
  });

  it("rejects mismatched sample rates, invalid RIFF and half-empty source even with a WAV filename upstream", () => {
    expect(() => renderAudioJob231(base([pcm([100]), pcm([200], 16000)]))).toThrow(/AUDIO_231_LAYOUT_MISMATCH/u);
    const invalid = pcm([1, 2]); new Uint8Array(invalid)[0] = 0;
    expect(() => renderAudioJob231(base([invalid]))).toThrow(/AUDIO_231_INVALID_RIFF/u);
    expect(() => renderAudioJob231(base([new ArrayBuffer(0)]))).toThrow(/AUDIO_231_INPUT_LIMIT/u);
  });

  it("rejects already-aborted render and invalid DSP targets", () => {
    const stop = new AbortController(); stop.abort();
    expect(() => renderAudioJob231(base([pcm([1, 2, 3])]), stop.signal)).toThrow(/cancelled/u);
    expect(() => renderAudioJob231(base([pcm([1, 2, 3])], { dsp: { normalize: { targetPeakSample: 50000 } } })))
      .toThrow(/AUDIO_231_INVALID_NORMALIZE/u);
  });

  it("refuses forged WAV waveform headers instead of rendering a plausible visual", () => {
    const valid = new Uint8Array(pcm([0, 1000, -32768, 32767]));
    expect(waveformPeaks231(valid, 4)).toEqual([0, 1000 / 32768, 1, 32767 / 32768]);
    const tampered = valid.slice(); new DataView(tampered.buffer).setUint32(40, 1000, true);
    expect(() => waveformPeaks231(tampered)).toThrow(/AUDIO_231_WAVEFORM_INPUT/u);
    expect(() => waveformPeaks231(valid, 999)).toThrow(/AUDIO_231_WAVEFORM_INPUT/u);
  });
});
