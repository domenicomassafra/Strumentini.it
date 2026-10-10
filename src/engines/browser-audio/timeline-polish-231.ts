/**
 * #231 opt-in native PCM16 WAV polish over the EXISTING bounded timeline DSP.
 *
 * The existing renderer ALREADY provides speed (pitch-changing linear
 * varispeed), threshold silence removal and exact sample-peak normalization.
 * This file does not reimplement them. It adds two actually missing opt-in
 * operations:
 * - dip-to-zero smoothing at verified, now-adjacent hard edit/silence joins;
 * - pooled multichannel SAMPLE RMS gain measured after existing DSP/smoothing.
 *
 * No WebAudio dependency, codec conversion, pitch preservation, LUFS/true-peak
 * claim, hidden limiter, network request, or detached worker. Call in a
 * terminating Worker for long jobs as the existing 231 UI does.
 */
import {
  renderAudioTimelineDsp231,
  type AudioDspSettings231,
  type AudioDspPreview231,
} from "./timeline-dsp-231";
import type { AudioTimelineEdit231 } from "./timeline-231";

const PCM_HEADER = 44;
const MAX_DIP_FRAMES = 1024;
const MAX_RMS_GAIN = 4;
const MAX_JOIN_COUNT = 4096 + 128;

export interface AudioPolishSettings231 {
  /** Fade both sides of an actual edit/silence join to zero (not crossfading).
   * 2–1024 native frames, only with speed ratio 1 to avoid false time mapping. */
  readonly declick?: { readonly windowFrames: number };
  /** PCM amplitude target (1–32767), not loudness units or guaranteed exact after quantization. */
  readonly rmsNormalize?: { readonly targetRmsSample: number };
}

export interface AudioPolishPreview231 {
  readonly base: AudioDspPreview231;
  readonly outputFrames: number;
  readonly outputBytes: number;
  readonly removedFrames: number;
  readonly softenedJoins: readonly number[];
  readonly smoothing: "disabled" | "zero-amplitude-dip";
  readonly normalization: "disabled" | "sample-rms";
  readonly rmsBefore: number;
  readonly rmsAfter: number;
  readonly rmsGain: number;
  readonly samplePeakAfter: number;
  readonly wavVerified: true;
  readonly caveats: readonly string[];
}

export interface AudioPolishRender231 {
  readonly wav: Uint8Array;
  readonly preview: AudioPolishPreview231;
}

function refuse(reason: string, message: string): never {
  throw new Error(`AUDIO_231_POLISH_${reason}: ${message}`);
}
function abort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("PCM16 polish aborted", "AbortError");
}
function names(value: unknown): string[] {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
}

function settingsAreValid(settings: AudioPolishSettings231): void {
  const props = names(settings);
  if (typeof settings !== "object" || settings === null || Array.isArray(settings) ||
      props.some((name) => name !== "declick" && name !== "rmsNormalize")) {
    refuse("INVALID", "Only declick and rmsNormalize setting objects are recognized");
  }
  if (settings.declick !== undefined &&
      (names(settings.declick).length !== 1 || names(settings.declick)[0] !== "windowFrames" ||
      !Number.isSafeInteger(settings.declick.windowFrames) || settings.declick.windowFrames < 2 ||
      settings.declick.windowFrames > MAX_DIP_FRAMES)) {
    refuse("INVALID", "Declick windowFrames must be a bounded integer from 2–1024");
  }
  if (settings.rmsNormalize !== undefined &&
      (names(settings.rmsNormalize).length !== 1 || names(settings.rmsNormalize)[0] !== "targetRmsSample" ||
      !Number.isSafeInteger(settings.rmsNormalize.targetRmsSample) || settings.rmsNormalize.targetRmsSample < 1 ||
      settings.rmsNormalize.targetRmsSample > 32767)) {
    refuse("INVALID", "RMS target must be an integer from 1–32767 sample units");
  }
}

/** Strictly maps a source-timeline boundary to the NEW retained timeline. */
function retainedBoundary(frame: number, removed: AudioDspPreview231["silenceRemoved"]): number {
  let before = 0;
  for (const span of removed) {
    if (span.startFrame >= frame) break;
    before += Math.min(span.endFrame, frame) - span.startFrame;
  }
  return frame - before;
}

function verifiedJoins(preview: AudioDspPreview231, window: number): number[] {
  if (preview.speedRatio !== 1) refuse("SPEED_MAPPING", "Declick only maps original native frames at 1× speed; varispeed still works without declick");
  const nativeJoins: number[] = [];
  let at = 0;
  for (const segment of preview.timeline.edits.slice(0, -1)) {
    at += segment.endFrame - segment.startFrame;
    nativeJoins.push(at);
  }
  for (const silence of preview.silenceRemoved) nativeJoins.push(silence.startFrame);
  if (nativeJoins.length > MAX_JOIN_COUNT) refuse("JOIN_LIMIT", "Join count exceeds bounded preview metadata");
  const joins = [...new Set(nativeJoins.map((frame) => retainedBoundary(frame, preview.silenceRemoved)))]
    .filter((frame) => frame > 0 && frame < preview.outputFrames).sort((a, b) => a - b);
  for (let index = 0; index < joins.length; index++) {
    const join = joins[index]!;
    if (join - window < 0 || join + window > preview.outputFrames ||
        (index > 0 && join - joins[index - 1]! < window * 2)) {
      refuse("JOIN_BOUNDS", "Requested dip windows overlap or exceed retained audio; smaller window required");
    }
  }
  return joins;
}

function measure(view: DataView, totalSamples: number, signal?: AbortSignal): {
  rms: number; peak: number; positivePeak: number; negativeMagnitude: number;
} {
  let squared = 0;
  let peak = 0;
  let positivePeak = 0;
  let negativeMagnitude = 0;
  for (let sample = 0; sample < totalSamples; sample++) {
    if ((sample & 8191) === 0) abort(signal);
    const value = view.getInt16(PCM_HEADER + sample * 2, true);
    squared += value * value;
    peak = Math.max(peak, Math.abs(value));
    if (value > 0) positivePeak = Math.max(positivePeak, value);
    else negativeMagnitude = Math.max(negativeMagnitude, -value);
  }
  abort(signal);
  return { rms: Math.sqrt(squared / totalSamples), peak, positivePeak, negativeMagnitude };
}

function outputShape(wav: Uint8Array, base: AudioDspPreview231): { view: DataView; totalSamples: number } {
  if (wav.length !== base.outputBytes || wav.length < 46 ||
      wav.length !== PCM_HEADER + base.outputFrames * base.timeline.channelCount * 2) {
    refuse("WAV_INTEGRITY", "DSP WAV/output frame sizes do not reconcile");
  }
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (at: number) => String.fromCharCode(...wav.subarray(at, at + 4));
  const count = base.timeline.channelCount;
  const rate = base.timeline.sampleRate;
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || tag(12) !== "fmt " || tag(36) !== "data" ||
      view.getUint32(4, true) !== wav.length - 8 || view.getUint32(16, true) !== 16 ||
      view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== count ||
      view.getUint32(24, true) !== rate || view.getUint32(28, true) !== rate * count * 2 ||
      view.getUint16(32, true) !== count * 2 || view.getUint16(34, true) !== 16 ||
      view.getUint32(40, true) !== wav.length - PCM_HEADER) {
    refuse("WAV_INTEGRITY", "Refused incorrect RIFF/PCM16 layout");
  }
  return { view, totalSamples: base.outputFrames * count };
}

/** Uses original bounded #231 DSP, modifies ONLY the newly rendered WAV output. */
export function renderAudioTimelinePolish231(
  sources: readonly Uint8Array[], edits: readonly AudioTimelineEdit231[],
  dsp: AudioDspSettings231, polish: AudioPolishSettings231,
  signal?: AbortSignal,
): AudioPolishRender231 {
  abort(signal);
  settingsAreValid(polish);
  if (polish.rmsNormalize !== undefined && dsp?.normalize !== undefined) {
    refuse("CONFLICT", "Choose one normalization: existing peak or optional RMS, never both");
  }
  // Explicitly restrict this adapter before expensive rendering when speed
  // cannot be mapped back to exact native splice boundaries.
  if (polish.declick !== undefined && dsp?.speed?.ratio !== undefined && dsp.speed.ratio !== 1) {
    refuse("SPEED_MAPPING", "Declick join mapping not verified for varispeed; use speed without declick");
  }
  const { wav, preview: base } = renderAudioTimelineDsp231(sources, edits, dsp, signal);
  abort(signal);
  const { view, totalSamples } = outputShape(wav, base);
  const joins = polish.declick === undefined ? [] : verifiedJoins(base, polish.declick.windowFrames);
  if (polish.declick !== undefined) {
    const width = polish.declick.windowFrames;
    for (const boundary of joins) {
      abort(signal);
      for (let at = 0; at < width; at++) {
        const leftFrame = boundary - width + at;
        const rightFrame = boundary + at;
        const leftGain = (width - 1 - at) / (width - 1);
        const rightGain = at / (width - 1);
        for (let channel = 0; channel < base.timeline.channelCount; channel++) {
          const leftOffset = PCM_HEADER + (leftFrame * base.timeline.channelCount + channel) * 2;
          const rightOffset = PCM_HEADER + (rightFrame * base.timeline.channelCount + channel) * 2;
          const left = view.getInt16(leftOffset, true);
          const right = view.getInt16(rightOffset, true);
          view.setInt16(leftOffset, Math.sign(left) * Math.round(Math.abs(left) * leftGain), true);
          view.setInt16(rightOffset, Math.sign(right) * Math.round(Math.abs(right) * rightGain), true);
        }
      }
    }
  }
  const measured = measure(view, totalSamples, signal);
  let gain = 1;
  if (polish.rmsNormalize !== undefined) {
    if (measured.rms === 0) refuse("SILENCE", "Digital silence cannot be RMS-normalized");
    gain = polish.rmsNormalize.targetRmsSample / measured.rms;
    if (!Number.isFinite(gain) || gain <= 0 || gain > MAX_RMS_GAIN) {
      refuse("GAIN_LIMIT", "RMS boost exceeds verified 4× limit");
    }
    // PCM16's negative endpoint is valid -32768, unlike its positive endpoint.
    if (gain * measured.positivePeak > 32767 || gain * measured.negativeMagnitude > 32768) {
      refuse("WOULD_CLIP", "Requested RMS level would saturate signed PCM16; no limiter enabled");
    }
    for (let sample = 0; sample < totalSamples; sample++) {
      if ((sample & 8191) === 0) abort(signal);
      const offset = PCM_HEADER + sample * 2;
      const old = view.getInt16(offset, true);
      const value = Math.sign(old) * Math.round(Math.abs(old) * gain);
      if (value > 32767 || value < -32768) refuse("WOULD_CLIP", "No implicit PCM saturation permitted");
      view.setInt16(offset, value, true);
    }
  }
  abort(signal);
  const after = measure(view, totalSamples, signal);
  // A WAV decoder will parse this unchanged header; sample count remains equal.
  outputShape(wav, base);
  return { wav, preview: {
    base, outputFrames: base.outputFrames, outputBytes: wav.length,
    removedFrames: base.removedFrames, softenedJoins: joins,
    smoothing: joins.length ? "zero-amplitude-dip" : "disabled",
    normalization: polish.rmsNormalize ? "sample-rms" : "disabled",
    rmsBefore: measured.rms, rmsAfter: after.rms, rmsGain: gain,
    samplePeakAfter: after.peak, wavVerified: true,
    caveats: [
      "Optional dip-to-zero is an intentionally audible short fade at verified hard joins; it is not pitch-preserving time-stretch, overlap crossfade or click-free guarantee.",
      "RMS normalization is pooled PCM amplitude, NOT LUFS, true-peak, broadcast normalization or automatic limiter; quantized result may differ from target.",
      "Native signed PCM16 mono/stereo WAV 8–48 kHz only. No codec conversion, network processing, shared UI promotion or physical mobile certification.",
    ],
  } };
}

/** A truthful preview: calculates exactly the rendered, checked PCM output. */
export function previewAudioTimelinePolish231(
  sources: readonly Uint8Array[], edits: readonly AudioTimelineEdit231[],
  dsp: AudioDspSettings231, polish: AudioPolishSettings231,
  signal?: AbortSignal,
): AudioPolishPreview231 {
  return renderAudioTimelinePolish231(sources, edits, dsp, polish, signal).preview;
}
