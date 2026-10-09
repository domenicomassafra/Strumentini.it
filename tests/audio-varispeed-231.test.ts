import { describe, expect, it } from "vitest";
import { previewAudioTimelineDsp231, renderAudioTimelineDsp231, type AudioDspSettings231 } from "../src/engines/browser-audio/timeline-dsp-231";
import { pcm16Wav231 } from "./fixtures/audio-dsp-231-corpus";

const monoEdit = (frames: number) => [{
  sourceIndex: 0, startFrame: 0, endFrame: frames, gain: 1, fadeInFrames: 0, fadeOutFrames: 0,
}];

function samples(wav: Uint8Array): number[][] {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const channels = view.getUint16(22, true);
  const count = view.getUint32(40, true) / (channels * 2);
  return Array.from({ length: channels }, (_, channel) => Array.from({ length: count }, (_, frame) =>
    view.getInt16(44 + 2 * (frame * channels + channel), true)));
}

describe("#231 bounded varispeed PCM16, NOT pitch-preserving time stretch", () => {
  it("halves timeline duration at 2x using center-sampled channel-independent interpolation", () => {
    const input = pcm16Wav231([[0, 1000, 2000, 3000], [0, -1000, -2000, -3000]]);
    const setting = { speed: { ratio: 2 } };
    const planned = previewAudioTimelineDsp231([input], monoEdit(4), setting);
    expect(planned).toMatchObject({ sourceTimelineFrames: 4, retainedFrames: 4,
      outputFrames: 2, outputBytes: 52, durationSeconds: 2 / 8000,
      speedRatio: 2, speedProcessing: "linear-varispeed-pitch-changes", retainedPeakSample: 3000,
      speedAdjustedPeakSample: 2500, outputPeakSample: 2500 });
    const result = renderAudioTimelineDsp231([input], monoEdit(4), setting);
    expect(result.preview).toEqual(planned);
    expect(samples(result.wav)).toEqual([[500, 2500], [-500, -2500]]);
    expect(result.preview.caveats.join(" ")).toMatch(/change pitch/iu);
  });

  it("doubles timeline duration at 0.5x and clamps the interpolated endpoints", () => {
    const input = pcm16Wav231([[0, 1000, 2000, 3000]]);
    const result = renderAudioTimelineDsp231([input], monoEdit(4), { speed: { ratio: 0.5 } });
    expect(result.preview).toMatchObject({ sourceTimelineFrames: 4, outputFrames: 8, speedRatio: 0.5,
      outputBytes: 60, durationSeconds: 8 / 8000, outputPeakSample: 3000 });
    expect(samples(result.wav)).toEqual([[0, 250, 750, 1250, 1750, 2250, 2750, 3000]]);
  });

  it("normalizes post-varispeed actual peak, not the peak discarded by faster frame selection", () => {
    const input = pcm16Wav231([[0, 1000, 2000, 3000], [0, -1000, -2000, -3000]]);
    const settings = { speed: { ratio: 2 }, normalize: { targetPeakSample: 10000 } };
    const out = renderAudioTimelineDsp231([input], monoEdit(4), settings);
    expect(out.preview).toMatchObject({ retainedPeakSample: 3000, speedAdjustedPeakSample: 2500,
      outputPeakSample: 10000, appliedGain: 4 });
    expect(samples(out.wav)).toEqual([[2000, 10000], [-2000, -10000]]);
  });

  it("removes qualifying silence BEFORE varispeed without inventing source frames", () => {
    const input = pcm16Wav231([[0, 0, 1000, 2000, 0, 0, 3000, 4000]]);
    const out = renderAudioTimelineDsp231([input], monoEdit(8), {
      silence: { thresholdSample: 0, minimumFrames: 2 }, speed: { ratio: 2 },
    });
    expect(out.preview.silenceRemoved).toEqual([{ startFrame: 0, endFrame: 2 }, { startFrame: 4, endFrame: 6 }]);
    expect(out.preview).toMatchObject({ sourceTimelineFrames: 8, removedFrames: 4,
      retainedFrames: 4, outputFrames: 2, speedAdjustedPeakSample: 3500 });
    expect(samples(out.wav)).toEqual([[1500, 3500]]);
  });

  it("reuses earlier retained frames safely when slower interpolation crosses a removed silence span", () => {
    // Original indices 4 and 5 are intentionally removed. At 0.5x the
    // interpolation repeatedly revisits retained index 1 after looking ahead
    // to index 2. A forward-only cursor must NOT start reading erased frames.
    const input = pcm16Wav231([[1000, 2000, 0, 0, 3000, 4000]]);
    const out = renderAudioTimelineDsp231([input], monoEdit(6), {
      silence: { thresholdSample: 0, minimumFrames: 2 }, speed: { ratio: 0.5 },
    });
    expect(out.preview.silenceRemoved).toEqual([{ startFrame: 2, endFrame: 4 }]);
    expect(samples(out.wav)).toEqual([[1000, 1250, 1750, 2250, 2750, 3250, 3750, 4000]]);
  });

  it("matches an independent array-filter + center-interpolation oracle over 36 multi-gap PCM inputs", () => {
    const ratios = [0.5, 0.75, 1, 1.25, 1.5, 2];
    for (let seed = 1; seed <= 6; seed += 1) {
      const channelA = Array.from({ length: 75 + seed }, (_, i) =>
        (i + seed) % 13 >= 4 && (i + seed) % 13 <= 6 ? 0 : (((i * 97 + seed * 313) % 15999) - 8000));
      const channelB = channelA.map((n) => n === 0 ? 0 : -n);
      const filtered: number[][] = [[], []];
      // Reference deliberately works on explicit arrays, not the production
      // monotone cursor. A quiet frame requires both channels to be zero.
      for (let i = 0; i < channelA.length;) {
        let end = i;
        const quiet = channelA[i] === 0 && channelB[i] === 0;
        while (end < channelA.length && (channelA[end] === 0 && channelB[end] === 0) === quiet) end += 1;
        if (!quiet || end - i < 2) {
          filtered[0]!.push(...channelA.slice(i, end));
          filtered[1]!.push(...channelB.slice(i, end));
        }
        i = end;
      }
      const input = pcm16Wav231([channelA, channelB]);
      for (const ratio of ratios) {
        const result = renderAudioTimelineDsp231([input], monoEdit(channelA.length), {
          silence: { thresholdSample: 0, minimumFrames: 2 }, speed: { ratio },
        });
        const count = Math.max(1, Math.round(filtered[0]!.length / ratio));
        const expected = filtered.map((channel) => Array.from({ length: count }, (_, j) => {
          const position = ratio === 1 ? j : Math.max(0, Math.min(channel.length - 1, (j + 0.5) * ratio - 0.5));
          const lower = Math.floor(position), upper = Math.min(channel.length - 1, lower + 1);
          const sample = channel[lower]! + (channel[upper]! - channel[lower]!) * (position - lower);
          return Math.sign(sample) * Math.round(Math.abs(sample));
        }));
        expect(result.preview.outputFrames, `seed=${seed}, ratio=${ratio}`).toBe(count);
        expect(samples(result.wav), `seed=${seed}, ratio=${ratio}`).toEqual(expected);
      }
    }
  });

  it("uses the legacy bit-identical path when requested speed is exactly 1", () => {
    const input = pcm16Wav231([[123, 456, -789, 1000]]);
    const noSpeed = renderAudioTimelineDsp231([input], monoEdit(4), {});
    const explicitOne = renderAudioTimelineDsp231([input], monoEdit(4), { speed: { ratio: 1 } });
    expect(explicitOne.wav).toEqual(noSpeed.wav);
    expect(explicitOne.preview.outputFrames).toBe(noSpeed.preview.outputFrames);
  });

  it("fail-closes invalid rates, not-actually-pitch-preserving requests, and missing speed shape", () => {
    const input = pcm16Wav231([[100, 200, 300, 400]]);
    const invalid = [0, 0.49, 2.01, Infinity, Number.NaN, "2"];
    for (const ratio of invalid) {
      expect(() => previewAudioTimelineDsp231([input], monoEdit(4), { speed: { ratio } } as AudioDspSettings231))
        .toThrow(/AUDIO_231_INVALID_SPEED/u);
    }
    for (const wrong of [{ speed: 2 }, { speed: { ratio: 2, preservePitch: true } },
      { timeStretch: { ratio: 2 } }, { speed: { ratio: 2, mode: "pitch-preserving" } }]) {
      expect(() => previewAudioTimelineDsp231([input], monoEdit(4), wrong as AudioDspSettings231))
        .toThrow(/AUDIO_231_(?:INVALID_SPEED|UNSUPPORTED_DSP)/u);
    }
  });

  it("refuses slower output beyond 60 seconds and the original output-size budget before allocation", () => {
    const input = pcm16Wav231([Array.from({ length: 33 * 8000 }, () => 100)]);
    expect(() => previewAudioTimelineDsp231([input], monoEdit(33 * 8000), { speed: { ratio: 0.5 } }))
      .toThrow(/AUDIO_231_OUTPUT_LIMIT/u);
  });

  it("propagates an aborted signal before expensive resampling and never returns stale output", () => {
    const input = pcm16Wav231([[1, 2, 3, 4]]);
    const controller = new AbortController(); controller.abort();
    expect(() => renderAudioTimelineDsp231([input], monoEdit(4), { speed: { ratio: 1.25 } }, controller.signal))
      .toThrow(/cancelled|aborted/iu);
  });
});
