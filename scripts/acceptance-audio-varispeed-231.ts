/**
 * #231 independent acceptance: export actual WAV files from the new native
 * PCM16 varispeed stage, then reopen with Python stdlib wave/struct and verify
 * frequency + duration of 2x and 0.5x operations. This is NOT a mobile device
 * receipt or proof of pitch-preserving time stretch.
 * Run: ./node_modules/.bin/tsx scripts/acceptance-audio-varispeed-231.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderAudioTimelineDsp231 } from "../src/engines/browser-audio/timeline-dsp-231";
import { pcm16Wav231 } from "../tests/fixtures/audio-dsp-231-corpus";

const sampleRate = 8000;
const sine = Array.from({ length: sampleRate }, (_, i) =>
  Math.round(10_000 * Math.sin(2 * Math.PI * 440 * i / sampleRate)));
const input = pcm16Wav231([sine, sine.map((sample) => -sample)], sampleRate);
const edits = [{ sourceIndex: 0, startFrame: 0, endFrame: sampleRate,
  gain: 1, fadeInFrames: 0, fadeOutFrames: 0 }];
const fast = renderAudioTimelineDsp231([input], edits, { speed: { ratio: 2 } });
const slow = renderAudioTimelineDsp231([input], edits, { speed: { ratio: 0.5 } });

const folder = mkdtempSync(join(tmpdir(), "strumentini-audio231-varispeed-"));
try {
  const fastPath = join(folder, "fast-2x.wav");
  const slowPath = join(folder, "slow-half.wav");
  writeFileSync(fastPath, fast.wav);
  writeFileSync(slowPath, slow.wav);
  const check = String.raw`import sys, wave, struct
expected = [(sys.argv[1], 4000, 880), (sys.argv[2], 16000, 220)]
for path, expected_frames, expected_hz in expected:
    with wave.open(path, 'rb') as wav:
        assert wav.getcomptype() == 'NONE', (path, wav.getcomptype())
        assert wav.getframerate() == 8000
        assert wav.getnchannels() == 2 and wav.getsampwidth() == 2
        assert wav.getnframes() == expected_frames, (path, wav.getnframes())
        raw = wav.readframes(expected_frames)
    assert len(raw) == expected_frames * 4
    samples = struct.unpack('<' + 'h' * expected_frames * 2, raw)
    left, right = samples[::2], samples[1::2]
    assert all(abs(a+b) <= 1 for a,b in zip(left,right)), path
    assert max(map(abs,left)) <= 10000
    crossings = sum(a <= 0 < b for a,b in zip(left, left[1:]))
    measured_hz = crossings * 8000 / expected_frames
    assert abs(measured_hz - expected_hz) <= 4, (path, expected_hz, measured_hz)
    print('PYTHON_WAVE_231_VARISPEED_FILE', path.rsplit('/',1)[-1],
          'frames', expected_frames, 'frequency', measured_hz)
print('PYTHON_WAVE_231_VARISPEED_PASS real_pcm16_files=true pitch_changes=true')`;
  const result = execFileSync("python3", ["-c", check, fastPath, slowPath], { encoding: "utf8", timeout: 15_000 });
  if (!result.includes("PYTHON_WAVE_231_VARISPEED_PASS")) throw new Error("Independent acceptance missing");
  console.log(result.trim());
} finally {
  rmSync(folder, { recursive: true, force: true });
}
