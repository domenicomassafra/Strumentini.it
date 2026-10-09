import type { AudioTimelineEdit231 } from "../../src/engines/browser-audio/timeline-231";
import type { AudioDspSettings231 } from "../../src/engines/browser-audio/timeline-dsp-231";

/** Deterministic *real* PCM16 RIFF/WAVE samples, never mocked audio envelopes. */
export function pcm16Wav231(channels: readonly (readonly number[])[], sampleRate = 8000): Uint8Array {
  if (channels.length < 1 || channels.length > 2 || channels[0]!.length < 1 || channels.some((channel) => channel.length !== channels[0]!.length)) {
    throw new Error("Invalid PCM16 fixture shape");
  }
  const frames = channels[0]!.length;
  const wav = new Uint8Array(44 + frames * channels.length * 2);
  const view = new DataView(wav.buffer);
  const tag = (at: number, value: string) => { for (let i = 0; i < 4; i += 1) wav[at + i] = value.charCodeAt(i); };
  tag(0, "RIFF"); view.setUint32(4, wav.length - 8, true);
  tag(8, "WAVE"); tag(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true); view.setUint16(34, 16, true);
  tag(36, "data"); view.setUint32(40, wav.length - 44, true);
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels.length; channel += 1) {
      const sample = channels[channel]![frame]!;
      if (!Number.isInteger(sample) || sample < -32768 || sample > 32767) throw new Error("Invalid PCM16 fixture sample");
      view.setInt16(44 + (frame * channels.length + channel) * 2, sample, true);
    }
  }
  return wav;
}

function block231(length: number, left: number, right: number): [number[], number[]] {
  return [Array.from({ length }, () => left), Array.from({ length }, () => right)];
}

function concat231(...blocks: Array<[number[], number[]]>): [number[], number[]] {
  return [blocks.flatMap((part) => part[0]), blocks.flatMap((part) => part[1])];
}

/**
 * Two physically encoded 8 kHz stereo WAVs (400 frames each). The ordered
 * timeline outputs source B then source A. Four silence runs are removed:
 * 50 + 50 + 100 + 200 frames. Retained amplitudes after 1.6x peak gain are
 * 200 frames (24000,-12000), 100 (16000,-8000), 100 (8000,-4000).
 */
export function audioDspCorpus231(): {
  sources: readonly Uint8Array[];
  edits: readonly AudioTimelineEdit231[];
  settings: AudioDspSettings231;
} {
  const sourceB = pcm16Wav231(concat231(
    block231(50, 0, 0), block231(200, 15000, -7500),
    block231(50, 0, 0), block231(100, 10000, -5000),
  ));
  const sourceA = pcm16Wav231(concat231(
    block231(100, 0, 0), block231(100, 5000, -2500), block231(200, 0, 0),
  ));
  return {
    sources: [sourceA, sourceB],
    edits: [
      { sourceIndex: 1, startFrame: 0, endFrame: 400, gain: 1, fadeInFrames: 0, fadeOutFrames: 0 },
      { sourceIndex: 0, startFrame: 0, endFrame: 400, gain: 1, fadeInFrames: 0, fadeOutFrames: 0 },
    ],
    settings: { normalize: { targetPeakSample: 24000 }, silence: { thresholdSample: 10, minimumFrames: 30 } },
  };
}
