/**
 * #231 stand-alone independent acceptance; no browser, network, device or
 * cloud claims. Writes real PCM16 WAV files and reopens them via Python's
 * independent stdlib wave/struct decoders (not the TypeScript engine/parser).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderAudioTimelineDsp231, previewAudioTimelineDsp231 } from "../src/engines/browser-audio/timeline-dsp-231";
import { audioDspCorpus231 } from "../tests/fixtures/audio-dsp-231-corpus";

const independentWaveOracle231 = String.raw`
import sys, wave, struct, math, os
paths = sys.argv[1:]
assert len(paths) == 3
def read(path):
    with wave.open(path, 'rb') as w:
        assert w.getcomptype() == 'NONE' and w.getsampwidth() == 2
        assert w.getnchannels() == 2 and w.getframerate() == 8000
        frames = w.getnframes()
        raw = w.readframes(frames)
    assert len(raw) == frames * 4
    assert os.stat(path).st_size == 44 + len(raw)
    return frames, list(struct.iter_unpack('<hh', raw))
first_frames, first = read(paths[0])
second_frames, second = read(paths[1])
output_frames, final = read(paths[2])
assert first_frames == second_frames == 400
assert first[:100] == [(0, 0)] * 100
assert first[100:200] == [(5000, -2500)] * 100
assert first[200:] == [(0, 0)] * 200
assert second[:50] == [(0, 0)] * 50
assert second[50:250] == [(15000, -7500)] * 200
assert second[250:300] == [(0, 0)] * 50
assert second[300:400] == [(10000, -5000)] * 100
assert output_frames == 400, output_frames
assert final == [(24000, -12000)] * 200 + [(16000, -8000)] * 100 + [(8000, -4000)] * 100
assert math.isclose(output_frames / 8000, 0.05, abs_tol=1e-12)
assert max(abs(x) for frame in final for x in frame) == 24000
print('PYTHON_WAVE_231_DSP_PASS input=2 pcm16=true channels=2 sample_rate=8000 timeline_frames=800 silence_removed=400 output_frames=400 peak=24000 gain=1.6 checked_samples=1600')
`;

const { sources, edits, settings } = audioDspCorpus231();
const planned = previewAudioTimelineDsp231(sources, edits, settings);
if (planned.outputFrames !== 400 || planned.removedFrames !== 400 || planned.appliedGain !== 1.6) {
  throw new Error("AUDIO_231_DSP_PREVIEW_MISMATCH");
}
const { wav, preview } = renderAudioTimelineDsp231(sources, edits, settings);
if (JSON.stringify(preview) !== JSON.stringify(planned) || wav.length !== planned.outputBytes) {
  throw new Error("AUDIO_231_DSP_RENDER_MISMATCH");
}
const temporary = mkdtempSync(join(tmpdir(), "audio-dsp-231-"));
try {
  const paths = [join(temporary, "source-a.wav"), join(temporary, "source-b.wav"), join(temporary, "normalized-no-silence.wav")];
  writeFileSync(paths[0]!, sources[0]!);
  writeFileSync(paths[1]!, sources[1]!);
  writeFileSync(paths[2]!, wav);
  process.stdout.write(execFileSync("python3", ["-c", independentWaveOracle231, ...paths], { encoding: "utf8", timeout: 10000 }));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
