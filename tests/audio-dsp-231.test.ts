import { describe, expect, it } from "vitest";
import { renderAudioTimeline231, type AudioTimelineEdit231 } from "../src/engines/browser-audio/timeline-231";
import { previewAudioTimelineDsp231, renderAudioTimelineDsp231, type AudioDspSettings231 } from "../src/engines/browser-audio/timeline-dsp-231";
import { audioDspCorpus231, pcm16Wav231 } from "./fixtures/audio-dsp-231-corpus";

const edit231 = (length: number): AudioTimelineEdit231 =>
  ({ sourceIndex: 0, startFrame: 0, endFrame: length, gain: 1, fadeInFrames: 0, fadeOutFrames: 0 });

function decodedSamples231(wav: Uint8Array): number[][] {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const channels = view.getUint16(22, true);
  const frames = view.getUint32(40, true) / (channels * 2);
  return Array.from({ length: channels }, (_, channel) => Array.from({ length: frames }, (_, frame) =>
    view.getInt16(44 + 2 * (frame * channels + channel), true)));
}

describe("#231 real native PCM16 peak-normalize + threshold silence DSP", () => {
  it("previews then emits verifiable reordered PCM16 WAV with exact silence spans and one common gain", () => {
    const { sources, edits, settings } = audioDspCorpus231();
    const planned = previewAudioTimelineDsp231(sources, edits, settings);
    expect(planned).toMatchObject({
      sourceTimelineFrames: 800, removedFrames: 400, outputFrames: 400,
      outputBytes: 44 + 400 * 4, durationSeconds: 400 / 8000,
      sourcePeakSample: 15000, retainedPeakSample: 15000, outputPeakSample: 24000,
      appliedGain: 1.6, normalization: "sample-peak", silenceRemoval: "threshold-runs",
    });
    expect(planned.timeline).toMatchObject({ sampleRate: 8000, channelCount: 2, outputFrames: 800 });
    expect(planned.silenceRemoved).toEqual([
      { startFrame: 0, endFrame: 50 }, { startFrame: 250, endFrame: 300 },
      { startFrame: 400, endFrame: 500 }, { startFrame: 600, endFrame: 800 },
    ]);
    const { wav, preview } = renderAudioTimelineDsp231(sources, edits, settings);
    expect(preview).toEqual(planned);
    expect(wav.byteLength).toBe(preview.outputBytes);
    const stereo = decodedSamples231(wav);
    expect(stereo[0]).toEqual([...Array(200).fill(24000), ...Array(100).fill(16000), ...Array(100).fill(8000)]);
    expect(stereo[1]).toEqual([...Array(200).fill(-12000), ...Array(100).fill(-8000), ...Array(100).fill(-4000)]);
  });

  it("preserves exact timeline WAV bytes when both DSP effects are disabled", () => {
    const { sources, edits } = audioDspCorpus231();
    const original = renderAudioTimeline231(sources, edits);
    const result = renderAudioTimelineDsp231(sources, edits, {});
    expect(result.wav).toEqual(original.wav);
    expect(result.preview.removedFrames).toBe(0);
    expect(result.preview.appliedGain).toBe(1);
  });

  it("joins adjacent quiet runs across distinct source edits before removing silence", () => {
    const left = pcm16Wav231([[100, 0, 0]]);
    const right = pcm16Wav231([[0, 0, -200]]);
    const edits: AudioTimelineEdit231[] = [
      { ...edit231(3), sourceIndex: 0 },
      { ...edit231(3), sourceIndex: 1 },
    ];
    const result = renderAudioTimelineDsp231([left, right], edits, { silence: { thresholdSample: 0, minimumFrames: 3 } });
    expect(result.preview.silenceRemoved).toEqual([{ startFrame: 1, endFrame: 5 }]);
    expect(result.preview.outputFrames).toBe(2);
    expect(decodedSamples231(result.wav)).toEqual([[100, -200]]);
  });

  it("re-applying the same settings is sample stable after exact peak and silence removal", () => {
    const { sources, edits, settings } = audioDspCorpus231();
    const first = renderAudioTimelineDsp231(sources, edits, settings);
    const second = renderAudioTimelineDsp231([first.wav], [edit231(first.preview.outputFrames)], settings);
    expect(second.wav).toEqual(first.wav);
    expect(second.preview.removedFrames).toBe(0);
    expect(second.preview.appliedGain).toBe(1);
  });

  it("preserves sub-minimum quiet runs and normalizes retained peak without touching output length", () => {
    const samples = [10000, 0, 0, 0, -5000, -10000, 1, 0, 10000];
    const wav = pcm16Wav231([samples]);
    const settings = { silence: { thresholdSample: 1, minimumFrames: 4 }, normalize: { targetPeakSample: 20000 } };
    const output = renderAudioTimelineDsp231([wav], [edit231(samples.length)], settings);
    expect(output.preview.removedFrames).toBe(0);
    expect(output.preview.silenceRemoved).toEqual([]);
    expect(decodedSamples231(output.wav)).toEqual([[20000, 0, 0, 0, -10000, -20000, 2, 0, 20000]]);
  });

  it("normalizes attenuation exactly and retains native signed PCM16 -32768 without clipping", () => {
    const wav = pcm16Wav231([[-32768, 32767, -16384, 0]]);
    const output = renderAudioTimelineDsp231([wav], [edit231(4)], { normalize: { targetPeakSample: 16384 } });
    expect(output.preview.appliedGain).toBe(0.5);
    expect(output.preview.outputPeakSample).toBe(16384);
    expect(decodedSamples231(output.wav)).toEqual([[-16384, 16384, -8192, 0]]);
  });

  it("refuses all-silent normalization and an all-dropped WAV with no valid data frames", () => {
    const wav = pcm16Wav231([[0, 0, 0, 0, 0, 0, 0, 0]]);
    expect(() => renderAudioTimelineDsp231([wav], [edit231(8)], { normalize: { targetPeakSample: 10000 } })).toThrow(/AUDIO_231_NORMALIZE_SILENCE/u);
    expect(() => renderAudioTimelineDsp231([wav], [edit231(8)], { silence: { thresholdSample: 0, minimumFrames: 2 } })).toThrow(/AUDIO_231_EMPTY_OUTPUT/u);
  });

  it("refuses unbounded amplification instead of claiming peak normalization", () => {
    const wav = pcm16Wav231([[500, -500]]);
    expect(() => renderAudioTimelineDsp231([wav], [edit231(2)], { normalize: { targetPeakSample: 10000 } })).toThrow(/AUDIO_231_NORMALIZE_GAIN_LIMIT/u);
  });

  it.each([
    [{ normalize: { targetPeakSample: -1 } }, /AUDIO_231_INVALID_NORMALIZE/u],
    [{ normalize: { targetPeakSample: 32768 } }, /AUDIO_231_INVALID_NORMALIZE/u],
    [{ normalize: { targetPeakSample: 0 / 0 } }, /AUDIO_231_INVALID_NORMALIZE/u],
    [{ silence: { thresholdSample: -1, minimumFrames: 2 } }, /AUDIO_231_INVALID_SILENCE/u],
    [{ silence: { thresholdSample: 2, minimumFrames: 0 } }, /AUDIO_231_INVALID_SILENCE/u],
    [{ silence: { thresholdSample: 10, minimumFrames: 200 } }, /AUDIO_231_INVALID_SILENCE/u],
    [{ speed: 1.5 }, /AUDIO_231_UNSUPPORTED_DSP/u],
    [{ normalize: { targetPeakSample: 10000, truePeak: true } }, /AUDIO_231_INVALID_NORMALIZE/u],
    [{ silence: { thresholdSample: 50, minimumFrames: 2, crossfade: true } }, /AUDIO_231_INVALID_SILENCE/u],
  ] as const)("refuses invalid/unsupported DSP request %# rather than silently applying fake processing", (settings, error) => {
    const wav = pcm16Wav231([[10, 20, 30, 40]]);
    expect(() => renderAudioTimelineDsp231([wav], [edit231(4)], settings as AudioDspSettings231)).toThrow(error);
  });

  it("honors native timeline source-frame bounds before doing DSP", () => {
    const wav = pcm16Wav231([[100, 200]]);
    expect(() => previewAudioTimelineDsp231([wav], [edit231(3)], {})).toThrow(/AUDIO_231_INVALID_RANGE/u);
  });

  it("refuses extreme fragmentation to keep run metadata bounded", () => {
    const samples = Array.from({ length: 8400 }, (_, frame) => frame % 2 === 0 ? 0 : 100);
    const wav = pcm16Wav231([samples]);
    expect(() => renderAudioTimelineDsp231([wav], [edit231(samples.length)], { silence: { thresholdSample: 0, minimumFrames: 1 } })).toThrow(/AUDIO_231_SILENCE_FRAGMENT_LIMIT/u);
  });

  it("observes an already aborted signal before rendering or allocating transformed WAV", () => {
    const { sources, edits, settings } = audioDspCorpus231();
    const controller = new AbortController();
    controller.abort();
    expect(() => previewAudioTimelineDsp231(sources, edits, settings, controller.signal)).toThrow(/cancelled|aborted/iu);
    expect(() => renderAudioTimelineDsp231(sources, edits, settings, controller.signal)).toThrow(/cancelled|aborted/iu);
  });
});
