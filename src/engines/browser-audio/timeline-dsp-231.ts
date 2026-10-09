/**
 * #231 isolated DSP extension for the verified, bounded native PCM16 timeline.
 * No resampling, time stretching, speed changes, LUFS claims or lossy codec.
 * A preview decodes the actual edited WAV (rather than estimating from a UI
 * slider); no network, WebAudio playback or worker is started by this module.
 *
 * Silence means all channels have abs(sample) <= thresholdSample in a native
 * frame. Runs of at least minimumFrames are fully removed (including at the
 * beginning/end); shorter runs remain. Joins are hard and may click.
 * Peak normalization targets the greatest absolute retained integer sample,
 * uses one common linear multiplier across channels, and refuses boosts >4x.
 */

import {
  planAudioTimeline231,
  renderAudioTimeline231,
  type AudioTimelineEdit231,
  type AudioTimelinePlan231,
} from "./timeline-231";

const HEADER_BYTES = 44;
const MAX_REMOVED_RUNS = 4096;
const MAX_GAIN = 4;

export interface AudioDspSettings231 {
  /** Disabled if absent. Peak amplitude in signed PCM16 sample units (1–32767). */
  readonly normalize?: { readonly targetPeakSample: number };
  /** Disabled if absent. Native frames on the edited timeline. */
  readonly silence?: { readonly thresholdSample: number; readonly minimumFrames: number };
}

export interface AudioDspRemovedSpan231 {
  readonly startFrame: number;
  readonly endFrame: number;
}

export interface AudioDspPreview231 {
  readonly timeline: AudioTimelinePlan231;
  readonly sourceTimelineFrames: number;
  readonly removedFrames: number;
  readonly outputFrames: number;
  readonly outputBytes: number;
  readonly durationSeconds: number;
  readonly sourcePeakSample: number;
  readonly retainedPeakSample: number;
  readonly outputPeakSample: number;
  readonly appliedGain: number;
  readonly silenceRemoved: readonly AudioDspRemovedSpan231[];
  readonly normalization: "disabled" | "sample-peak";
  readonly silenceRemoval: "disabled" | "threshold-runs";
  readonly format: "RIFF/WAVE signed PCM16 LE";
  readonly caveats: readonly string[];
}

export interface AudioDspRender231 {
  readonly wav: Uint8Array;
  readonly preview: AudioDspPreview231;
}

function fail(code: string, message: string): never {
  throw new Error(`${code}: ${message}`);
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Audio DSP cancelled", "AbortError");
}

function keys(value: unknown): string[] {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
}

function validateSettings(settings: AudioDspSettings231): void {
  if (settings === null || typeof settings !== "object" || Array.isArray(settings)) fail("AUDIO_231_INVALID_DSP", "DSP settings must be an object");
  if (Object.keys(settings).some((key) => key !== "normalize" && key !== "silence")) {
    fail("AUDIO_231_UNSUPPORTED_DSP", "Only native sample-peak normalization and threshold silence removal are supported; speed/time stretching is refused");
  }
  if (settings.normalize !== undefined) {
    if (keys(settings.normalize).length !== 1 || !keys(settings.normalize).includes("targetPeakSample") ||
        !Number.isSafeInteger(settings.normalize.targetPeakSample) || settings.normalize.targetPeakSample < 1 || settings.normalize.targetPeakSample > 32767) {
      fail("AUDIO_231_INVALID_NORMALIZE", "targetPeakSample must be an integer from 1 through 32767");
    }
  }
  if (settings.silence !== undefined) {
    if (keys(settings.silence).length !== 2 || !keys(settings.silence).includes("thresholdSample") || !keys(settings.silence).includes("minimumFrames") ||
        !Number.isSafeInteger(settings.silence.thresholdSample) || settings.silence.thresholdSample < 0 || settings.silence.thresholdSample > 32767 ||
        !Number.isSafeInteger(settings.silence.minimumFrames) || settings.silence.minimumFrames < 1) {
      fail("AUDIO_231_INVALID_SILENCE", "thresholdSample must be 0–32767; minimumFrames must be a positive integer");
    }
  }
}

function sampleAt(data: DataView, channels: number, frame: number, channel: number): number {
  return data.getInt16(HEADER_BYTES + (frame * channels + channel) * 2, true);
}

interface Analyzed {
  readonly preview: AudioDspPreview231;
  readonly input: Uint8Array;
}

function analyze(
  sources: readonly Uint8Array[], edits: readonly AudioTimelineEdit231[],
  settings: AudioDspSettings231, signal?: AbortSignal,
): Analyzed {
  validateSettings(settings);
  checkAbort(signal);
  // Existing core validates native WAV structure, source/segment/output bounds,
  // channel/rate matching and gain/fade clipping before handing us canonical PCM.
  const timeline = planAudioTimeline231(sources, edits, signal);
  if (settings.silence !== undefined && settings.silence.minimumFrames > timeline.outputFrames) {
    fail("AUDIO_231_INVALID_SILENCE", "minimumFrames exceeds the entire edited timeline");
  }
  const rendered = renderAudioTimeline231(sources, edits, signal === undefined ? {} : { signal });
  const input = rendered.wav;
  const data = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const channels = timeline.channelCount;
  const frames = timeline.outputFrames;
  const removed: AudioDspRemovedSpan231[] = [];
  let runStart = -1;
  let sourcePeak = 0;
  const silence = settings.silence;
  for (let frame = 0; frame < frames; frame += 1) {
    if ((frame & 8191) === 0) checkAbort(signal);
    let maximum = 0;
    for (let channel = 0; channel < channels; channel += 1) maximum = Math.max(maximum, Math.abs(sampleAt(data, channels, frame, channel)));
    sourcePeak = Math.max(sourcePeak, maximum);
    const quiet = silence !== undefined && maximum <= silence.thresholdSample;
    if (quiet && runStart < 0) runStart = frame;
    if (!quiet && runStart >= 0) {
      if (frame - runStart >= silence!.minimumFrames) {
        if (removed.length >= MAX_REMOVED_RUNS) fail("AUDIO_231_SILENCE_FRAGMENT_LIMIT", "Silence segmentation exceeds 4096 runs");
        removed.push({ startFrame: runStart, endFrame: frame });
      }
      runStart = -1;
    }
  }
  if (runStart >= 0 && frames - runStart >= silence!.minimumFrames) {
    if (removed.length >= MAX_REMOVED_RUNS) fail("AUDIO_231_SILENCE_FRAGMENT_LIMIT", "Silence segmentation exceeds 4096 runs");
    removed.push({ startFrame: runStart, endFrame: frames });
  }
  const removedFrames = removed.reduce((sum, span) => sum + span.endFrame - span.startFrame, 0);
  const outputFrames = frames - removedFrames;
  if (outputFrames < 1) fail("AUDIO_231_EMPTY_OUTPUT", "Silence removal would produce an empty WAV");
  let retainedPeak = 0;
  let removedIndex = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    if ((frame & 8191) === 0) checkAbort(signal);
    while (removedIndex < removed.length && frame >= removed[removedIndex]!.endFrame) removedIndex += 1;
    const dropped = removedIndex < removed.length && frame >= removed[removedIndex]!.startFrame;
    if (dropped) continue;
    for (let channel = 0; channel < channels; channel += 1) retainedPeak = Math.max(retainedPeak, Math.abs(sampleAt(data, channels, frame, channel)));
  }
  const target = settings.normalize?.targetPeakSample;
  if (target !== undefined && retainedPeak === 0) fail("AUDIO_231_NORMALIZE_SILENCE", "Digital silence has no peak to normalize");
  const gain = target === undefined ? 1 : target / retainedPeak;
  if (!Number.isFinite(gain) || gain > MAX_GAIN) fail("AUDIO_231_NORMALIZE_GAIN_LIMIT", "Required peak boost exceeds bounded 4× gain; output refused");
  checkAbort(signal);
  return {
    input,
    preview: {
      timeline, sourceTimelineFrames: frames, removedFrames, outputFrames,
      outputBytes: HEADER_BYTES + outputFrames * channels * 2,
      durationSeconds: outputFrames / timeline.sampleRate,
      sourcePeakSample: sourcePeak, retainedPeakSample: retainedPeak,
      outputPeakSample: target ?? retainedPeak, appliedGain: gain,
      silenceRemoved: removed,
      normalization: target === undefined ? "disabled" : "sample-peak",
      silenceRemoval: silence === undefined ? "disabled" : "threshold-runs",
      format: "RIFF/WAVE signed PCM16 LE",
      caveats: [
        "Peak amplitude normalization is not perceived-loudness (LUFS), RMS or true-peak normalization.",
        "Silence removal uses a per-frame absolute PCM threshold and removes complete qualifying runs; hard joins may click.",
        "Native-rate PCM16 only, no speed/time stretching, codec conversion, cloud execution, device or playback acceptance.",
      ],
    },
  };
}

/** Exact, bounded preview computed on the *rendered* audio timeline. */
export function previewAudioTimelineDsp231(
  sources: readonly Uint8Array[], edits: readonly AudioTimelineEdit231[],
  settings: AudioDspSettings231, signal?: AbortSignal,
): AudioDspPreview231 {
  return analyze(sources, edits, settings, signal).preview;
}

function writeTag(bytes: Uint8Array, at: number, tag: string): void {
  for (let i = 0; i < 4; i += 1) bytes[at + i] = tag.charCodeAt(i);
}

/** Output is a real strict canonical PCM16 WAV; clips are refused, not hidden. */
export function renderAudioTimelineDsp231(
  sources: readonly Uint8Array[], edits: readonly AudioTimelineEdit231[],
  settings: AudioDspSettings231, signal?: AbortSignal,
): AudioDspRender231 {
  const { preview, input } = analyze(sources, edits, settings, signal);
  checkAbort(signal);
  const output = new Uint8Array(preview.outputBytes);
  const data = new DataView(output.buffer);
  writeTag(output, 0, "RIFF"); data.setUint32(4, output.byteLength - 8, true);
  writeTag(output, 8, "WAVE"); writeTag(output, 12, "fmt "); data.setUint32(16, 16, true);
  data.setUint16(20, 1, true); data.setUint16(22, preview.timeline.channelCount, true);
  data.setUint32(24, preview.timeline.sampleRate, true);
  data.setUint32(28, preview.timeline.sampleRate * preview.timeline.channelCount * 2, true);
  data.setUint16(32, preview.timeline.channelCount * 2, true);
  data.setUint16(34, 16, true); writeTag(output, 36, "data");
  data.setUint32(40, output.length - HEADER_BYTES, true);

  const sourceData = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const channels = preview.timeline.channelCount;
  let cursor = 0;
  let droppedIndex = 0;
  let actualPeak = 0;
  for (let frame = 0; frame < preview.sourceTimelineFrames; frame += 1) {
    if ((frame & 8191) === 0) checkAbort(signal);
    while (droppedIndex < preview.silenceRemoved.length && frame >= preview.silenceRemoved[droppedIndex]!.endFrame) droppedIndex += 1;
    if (droppedIndex < preview.silenceRemoved.length && frame >= preview.silenceRemoved[droppedIndex]!.startFrame) continue;
    for (let channel = 0; channel < channels; channel += 1) {
      const original = sampleAt(sourceData, channels, frame, channel);
      const scaled = Math.sign(original) * Math.round(Math.abs(original) * preview.appliedGain);
      if (!Number.isFinite(scaled) || scaled < -32768 || scaled > 32767) {
        fail("AUDIO_231_NORMALIZE_CLIP", "DSP sample would saturate PCM16; refused");
      }
      data.setInt16(HEADER_BYTES + (cursor * channels + channel) * 2, scaled, true);
      actualPeak = Math.max(actualPeak, Math.abs(scaled));
    }
    cursor += 1;
  }
  checkAbort(signal);
  if (cursor !== preview.outputFrames || actualPeak !== preview.outputPeakSample) {
    fail("AUDIO_231_DSP_RECONCILE", "Rendered frame count or peak differs from preview");
  }
  return { wav: output, preview };
}
