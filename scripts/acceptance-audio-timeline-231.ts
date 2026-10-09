/** Real generated WAV files checked with independent Python stdlib wave/struct.
 * This is an isolated desktop-only PCM16 proof, NOT a codec or mobile promotion.
 * Run: ./node_modules/.bin/tsx scripts/acceptance-audio-timeline-231.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planAudioTimeline231, renderAudioTimeline231 } from "../src/engines/browser-audio/timeline-231";

function constantStereoWav(left: number, right: number, frames: number): Uint8Array {
  const wave = new Uint8Array(44 + frames * 4);
  const data = new DataView(wave.buffer);
  const tag = (offset: number, text: string): void => { for (let i = 0; i < 4; i++) wave[offset + i] = text.charCodeAt(i); };
  tag(0, "RIFF"); data.setUint32(4, wave.length - 8, true); tag(8, "WAVE"); tag(12, "fmt ");
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
  data.setUint32(24, 48_000, true); data.setUint32(28, 192_000, true);
  data.setUint16(32, 4, true); data.setUint16(34, 16, true);
  tag(36, "data"); data.setUint32(40, frames * 4, true);
  for (let i = 0; i < frames; i += 1) {
    data.setInt16(44 + i * 4, left, true); data.setInt16(46 + i * 4, right, true);
  }
  return wave;
}

const pythonIndependentWaveProbe = String.raw`
import sys, wave, struct, math
inputs = []
for path, expected in zip(sys.argv[1:3], [(12000,-12000), (6000,-6000)]):
    with wave.open(path, 'rb') as w:
        assert w.getnchannels() == 2 and w.getframerate() == 48000
        assert w.getsampwidth() == 2 and w.getnframes() == 1000
        raw = w.readframes(1000)
        pairs = list(struct.iter_unpack('<hh', raw))
        assert len(pairs) == 1000 and all(p == expected for p in pairs)
        inputs.append(pairs)
with wave.open(sys.argv[3], 'rb') as w:
    assert w.getnchannels() == 2 and w.getframerate() == 48000
    assert w.getsampwidth() == 2 and w.getnframes() == 220
    actual = list(struct.iter_unpack('<hh', w.readframes(w.getnframes())))
assert actual[:120] == inputs[1][100:220]
assert len(actual[120:]) == 100
for i, (left, right) in enumerate(actual[120:]):
    envelope = 0.5
    if i < 10:
        envelope *= i / 9
    if i >= 90:
        envelope *= (99 - i) / 9
    reference = round(12000 * envelope)
    assert left == reference and right == -reference, (i, left, right, reference)
assert actual[120] == (0, 0) and actual[-1] == (0, 0)
print('PYTHON_WAVE_INDEPENDENT_ROUNDTRIP_PASS sources=2 channels=2 rate=48000 output_frames=220 sample_vectors=440')
`;

const temp = mkdtempSync(join(tmpdir(), "audio-231-"));
try {
  const first = constantStereoWav(12_000, -12_000, 1000);
  const second = constantStereoWav(6000, -6000, 1000);
  const edits = [
    { sourceIndex: 1, startFrame: 100, endFrame: 220, gain: 1, fadeInFrames: 0, fadeOutFrames: 0 },
    { sourceIndex: 0, startFrame: 20, endFrame: 120, gain: 0.5, fadeInFrames: 10, fadeOutFrames: 10 },
  ];
  const plan = planAudioTimeline231([first, second], edits);
  if (plan.outputFrames !== 220 || plan.durationSeconds !== 220 / 48_000 || plan.outputBytes !== 924) {
    throw new Error("AUDIO_231_PREVIEW_INCONSISTENT");
  }
  const output = renderAudioTimeline231([first, second], edits);
  if (output.wav.length !== plan.outputBytes) throw new Error("AUDIO_231_SIZE_MISMATCH");
  const paths = [join(temp, "input-a.wav"), join(temp, "input-b.wav"), join(temp, "edited.wav")];
  writeFileSync(paths[0]!, first); writeFileSync(paths[1]!, second); writeFileSync(paths[2]!, output.wav);
  process.stdout.write(execFileSync("python3", ["-c", pythonIndependentWaveProbe, ...paths], { encoding: "utf8" }));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
