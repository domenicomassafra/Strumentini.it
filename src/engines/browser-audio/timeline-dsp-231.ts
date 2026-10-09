/**
 * #231 isolated DSP extension for the verified, bounded native PCM16 timeline.
 * No cross-rate source resampling, pitch-preserving time stretching, LUFS or lossy codecs.
 * Optional linear varispeed resamples the edited PCM within its same WAV rate:
 * a speed change ALSO changes pitch. Never label it pitch-preserving.
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
  AUDIO_231_MAX_FRAMES,
  AUDIO_231_MAX_OUTPUT_BYTES,
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
  /** Optional varispeed 0.5x–2x; changes pitch (NOT pitch-preserving time stretch). */
  readonly speed?: { readonly ratio: number };
}

export interface AudioDspRemovedSpan231 {
  readonly startFrame: number;
  readonly endFrame: number;
}

export interface AudioDspPreview231 {
  readonly timeline: AudioTimelinePlan231;
  readonly sourceTimelineFrames: number;
  readonly removedFrames: number;
  /** Frames remaining after hard silence removal, before changing speed. */
  readonly retainedFrames: number;
  readonly outputFrames: number;
  readonly outputBytes: number;
  readonly durationSeconds: number;
  readonly sourcePeakSample: number;
  readonly retainedPeakSample: number;
  /** Absolute peak after varispeed interpolation, before normalization. */
  readonly speedAdjustedPeakSample: number;
  readonly outputPeakSample: number;
  readonly appliedGain: number;
  readonly speedRatio: number;
  readonly speedProcessing: "disabled" | "linear-varispeed-pitch-changes";
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
  if (Object.keys(settings).some((key) => key !== "normalize" && key !== "silence" && key !== "speed")) {
    fail("AUDIO_231_UNSUPPORTED_DSP", "Only peak normalization, threshold silence removal and pitch-changing varispeed are supported");
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
  if (settings.speed !== undefined) {
    if (typeof settings.speed === "number") {
      fail("AUDIO_231_UNSUPPORTED_DSP", "Numeric speed without explicit pitch-changing varispeed settings remains unsupported");
    }
    if (keys(settings.speed).length !== 1 || !keys(settings.speed).includes("ratio") ||
        typeof settings.speed.ratio !== "number" || !Number.isFinite(settings.speed.ratio) ||
        settings.speed.ratio < 0.5 || settings.speed.ratio > 2) {
      fail("AUDIO_231_INVALID_SPEED", "Only numeric 0.5x–2x linear varispeed that changes pitch is supported");
    }
  }
}

function sampleAt(data: DataView, channels: number, frame: number, channel: number): number {
  return data.getInt16(HEADER_BYTES + (frame * channels + channel) * 2, true);
}

/**
 * Visit samples of the timeline AFTER silence removal in chronological order.
 * Map retained indices to original frames with a monotonic cursor, without
 * allocating an unbounded frame-index array. Center-of-output-frame sampling
 * is used for speed changes; source endpoints are explicitly clamped.
 * Interpolating across a hard silence cut is intentional, not click repair.
 */
function forEachVarispeedSample231(
  data: DataView, channels: number, retainedFrames: number,
  removed: readonly AudioDspRemovedSpan231[], outputFrames: number,
  ratio: number, signal: AbortSignal | undefined,
  accept: (frame: number, channel: number, sample: number) => void,
): void {
  let removedCursor = 0;
  let skippedFrames = 0;
  const originalFrame = (retainedIndex: number): number => {
    while (removedCursor < removed.length &&
           retainedIndex >= removed[removedCursor]!.startFrame - skippedFrames) {
      const span = removed[removedCursor]!;
      skippedFrames += span.endFrame - span.startFrame;
      removedCursor += 1;
    }
    return retainedIndex + skippedFrames;
  };
  for (let frame = 0; frame < outputFrames; frame += 1) {
    if ((frame & 8191) === 0) checkAbort(signal);
    const position = ratio === 1 ? frame : Math.max(0, Math.min(retainedFrames - 1, (frame + 0.5) * ratio - 0.5));
    const low = Math.floor(position);
    const high = Math.min(low + 1, retainedFrames - 1);
    const blend = position - low;
    const sourceLow = originalFrame(low);
    // Look ahead without advancing the monotonic cursor: at slow speeds the
    // next output frame can revisit `low` before it advances to `high`.
    // Advancing removal state for `high` here would cause a later `low` to
    // address erased silence instead of the retained sample.
    const nextRemoval = removed[removedCursor];
    const sourceHigh = high === low ? sourceLow :
      (nextRemoval && sourceLow + 1 === nextRemoval.startFrame ? nextRemoval.endFrame : sourceLow + 1);
    for (let channel = 0; channel < channels; channel += 1) {
      const first = sampleAt(data, channels, sourceLow, channel);
      const sample = blend === 0 ? first : first + (sampleAt(data, channels, sourceHigh, channel) - first) * blend;
      accept(frame, channel, sample);
    }
  }
  checkAbort(signal);
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
  const retainedFrames = frames - removedFrames;
  if (retainedFrames < 1) fail("AUDIO_231_EMPTY_OUTPUT", "Silence removal would produce an empty WAV");
  const speedRatio = settings.speed?.ratio ?? 1;
  const outputFrames = Math.max(1, Math.round(retainedFrames / speedRatio));
  const outputBytes = HEADER_BYTES + outputFrames * channels * 2;
  if (outputFrames > Math.min(AUDIO_231_MAX_FRAMES, timeline.sampleRate * 60) || outputBytes > AUDIO_231_MAX_OUTPUT_BYTES) {
    fail("AUDIO_231_OUTPUT_LIMIT", "Varispeed output exceeds 60 seconds or the existing 12 MiB budget");
  }
  let retainedPeak = 0;
  let removedIndex = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    if ((frame & 8191) === 0) checkAbort(signal);
    while (removedIndex < removed.length && frame >= removed[removedIndex]!.endFrame) removedIndex += 1;
    const dropped = removedIndex < removed.length && frame >= removed[removedIndex]!.startFrame;
    if (dropped) continue;
    for (let channel = 0; channel < channels; channel += 1) retainedPeak = Math.max(retainedPeak, Math.abs(sampleAt(data, channels, frame, channel)));
  }
  let speedPeak = retainedPeak;
  if (speedRatio !== 1) {
    speedPeak = 0;
    forEachVarispeedSample231(data, channels, retainedFrames, removed, outputFrames, speedRatio, signal,
      (_frame, _channel, sample) => { speedPeak = Math.max(speedPeak, Math.abs(sample)); });
  }
  const target = settings.normalize?.targetPeakSample;
  if (target !== undefined && speedPeak === 0) fail("AUDIO_231_NORMALIZE_SILENCE", "Digital silence has no peak to normalize");
  const gain = target === undefined ? 1 : target / speedPeak;
  if (!Number.isFinite(gain) || gain > MAX_GAIN) fail("AUDIO_231_NORMALIZE_GAIN_LIMIT", "Required peak boost exceeds bounded 4× gain; output refused");
  checkAbort(signal);
  return {
    input,
    preview: {
      timeline, sourceTimelineFrames: frames, removedFrames, retainedFrames, outputFrames,
      outputBytes,
      durationSeconds: outputFrames / timeline.sampleRate,
      sourcePeakSample: sourcePeak, retainedPeakSample: retainedPeak, speedAdjustedPeakSample: speedPeak,
      outputPeakSample: target ?? Math.round(speedPeak), appliedGain: gain,
      speedRatio, speedProcessing: speedRatio === 1 ? "disabled" : "linear-varispeed-pitch-changes",
      silenceRemoved: removed,
      normalization: target === undefined ? "disabled" : "sample-peak",
      silenceRemoval: silence === undefined ? "disabled" : "threshold-runs",
      format: "RIFF/WAVE signed PCM16 LE",
      caveats: [
        "Peak amplitude normalization is not perceived-loudness (LUFS), RMS or true-peak normalization.",
        "Silence removal uses a per-frame absolute PCM threshold and removes complete qualifying runs; hard joins may click.",
        "Varispeed uses linear PCM sample interpolation. Speed changes ALSO change pitch; this is NOT pitch-preserving time stretching or click repair.",
        "Native-rate PCM16 only, no source-rate conversion, lossy codecs, cloud execution, device or playback acceptance.",
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
  let actualPeak = 0;
  forEachVarispeedSample231(sourceData, channels, preview.retainedFrames,
    preview.silenceRemoved, preview.outputFrames, preview.speedRatio, signal,
    (frame, channel, original) => {
      const scaled = Math.sign(original) * Math.round(Math.abs(original) * preview.appliedGain);
      if (!Number.isFinite(scaled) || scaled < -32768 || scaled > 32767) {
        fail("AUDIO_231_NORMALIZE_CLIP", "DSP sample would saturate PCM16; refused");
      }
      data.setInt16(HEADER_BYTES + (frame * channels + channel) * 2, scaled, true);
      actualPeak = Math.max(actualPeak, Math.abs(scaled));
    });
  if (actualPeak !== preview.outputPeakSample) {
    fail("AUDIO_231_DSP_RECONCILE", "Rendered frame count or peak differs from preview");
  }
  return { wav: output, preview };
}
