/** #231 actual PCM16 WAV polished output, independently reopened in Python stdlib.
 * RUN: npx tsx scripts/acceptance-audio-polish-231.ts
 * Does NOT certify physical device playback, LUFS, pitch preservation, or prod.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderAudioTimelinePolish231 } from "../src/engines/browser-audio/timeline-polish-231";

const sampleRate = 8000;
const wav = (left: readonly number[], right: readonly number[]): Uint8Array => {
  const bytes = new Uint8Array(44 + left.length * 4);
  const view = new DataView(bytes.buffer);
  const fourcc = (at: number, tag: string): void => { for (let i = 0; i < 4; i++) bytes[at + i] = tag.charCodeAt(i); };
  fourcc(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); fourcc(8, "WAVE");
  fourcc(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 2, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true);
  view.setUint16(34, 16, true); fourcc(36, "data"); view.setUint32(40, bytes.length - 44, true);
  for (let i = 0; i < left.length; i++) {
    view.setInt16(44 + i * 4, left[i]!, true);
    view.setInt16(46 + i * 4, right[i]!, true);
  }
  return bytes;
};

const left = [10000, 10000, 10000, 10000, 0, 0, 0, 0, -10000, -10000, -10000, -10000];
const right = left.map((value) => -value / 2);
const input = wav(left, right);
const edit = [{ sourceIndex: 0, startFrame: 0, endFrame: left.length, gain: 1, fadeInFrames: 0, fadeOutFrames: 0 }];
const output = renderAudioTimelinePolish231([input], edit,
  { silence: { thresholdSample: 0, minimumFrames: 4 } },
  { declick: { windowFrames: 2 }, rmsNormalize: { targetRmsSample: 9500 } });

const folder = mkdtempSync(join(tmpdir(), "audio-polish-231-"));
try {
  const inputPath = join(folder, "in.wav");
  const outputPath = join(folder, "out.wav");
  writeFileSync(inputPath, input);
  writeFileSync(outputPath, output.wav);
  const program = String.raw`
import wave, struct, sys, math
before, after=sys.argv[1:]
with wave.open(before,'rb') as w:
  assert w.getnchannels()==2 and w.getframerate()==8000 and w.getsampwidth()==2 and w.getnframes()==12
  raw=w.readframes(w.getnframes())
  original=struct.unpack('<24h',raw)
with wave.open(after,'rb') as w:
  assert w.getnchannels()==2 and w.getframerate()==8000 and w.getsampwidth()==2 and w.getnframes()==8
  assert w.getcomptype()=='NONE'
  raw=w.readframes(w.getnframes())
  output=struct.unpack('<16h',raw)
left=output[0::2]; right=output[1::2]
assert left[3]==0 and left[4]==0 and right[3]==0 and right[4]==0
assert all(abs(a+2*b)<=1 for a,b in zip(left,right))
assert left[0]==left[1]==left[2] and left[5]==left[6]==left[7]
assert left[0]>0 and left[5]<0
rms=math.sqrt(sum(value*value for value in output)/len(output))
assert abs(rms-9500)<1.0, rms
peak=max(map(abs,output))
assert peak <= 32767
print('PYTHON_WAVE_231_POLISH_PASS sources=1 channels=2 rate=8000 input_frames=12 removed_frames=4 output_frames=8 sample_rms={:.4f} peak={} readback_samples={}'.format(rms,peak,len(output)))
`;
  const observed = execFileSync("python3", ["-c", program, inputPath, outputPath], { encoding: "utf8" });
  if (!observed.includes("PYTHON_WAVE_231_POLISH_PASS")) throw new Error("Independent WAV reopening failed");
  console.log(observed.trim());
  console.log(`VERIFIED #231 polish: base removed=${output.preview.removedFrames}, joins=${output.preview.softenedJoins}, RMS measured=${output.preview.rmsAfter.toFixed(4)}, bytes=${output.wav.byteLength}`);
} finally {
  rmSync(folder, { recursive: true, force: true });
}
