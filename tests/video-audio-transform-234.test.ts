import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractAudioWav234, validateAudioRange234, validateAudioSource234, verifyWav234 } from "../src/engines/video/audio-extract-234";
import { inspectMp4Local } from "../src/engines/video/mp4-inspection";
import { writeWav234 } from "../src/engines/video/wav-worker-234";

const fromFile = (path: string) => {
  const binary = readFileSync(new URL(`./${path}`, import.meta.url));
  return new File([binary], path, { type: "video/mp4" });
};

describe("#234 — actual browser capability gate and refusal", () => {
  it("accepts the genuine AAC/AVC video and refuses a genuine video without audio", async () => {
    const accepted = fromFile("video-audio-234-two-tones.mp4");
    validateAudioSource234(accepted, await inspectMp4Local(accepted));
    const silent = fromFile("video-frame-305-red-green.mp4");
    const inspected = await inspectMp4Local(silent);
    expect(() => validateAudioSource234(silent, inspected)).toThrow(/VIDEO_AUDIO_CODEC_UNSUPPORTED/u);
  });

  it("refuses multi-stream MP4 to avoid attributing an unproven audio track", async () => {
    const file = new File([readFileSync(new URL("../quality/fixtures/video-inspection/video-multistream.mp4", import.meta.url))], "multi.mp4");
    const inspected = await inspectMp4Local(file);
    expect(inspected.videoTracks).toBe(2);
    expect(() => validateAudioSource234(file, inspected)).toThrow(/VIDEO_AUDIO_CODEC_UNSUPPORTED/u);
  });

  it("plans sample boundaries and enforces duration and memory ceilings", () => {
    expect(validateAudioRange234({ startSeconds: 0.125, endSeconds: 0.625 }, 2, 48_000, 1)).toMatchObject({
      startFrame: 6_000, endFrame: 30_000, frames: 24_000, outputBytes: 48_044,
    });
    expect(() => validateAudioRange234({ startSeconds: 0.8, endSeconds: 0.7 }, 2, 48_000, 1)).toThrow(/VIDEO_AUDIO_RANGE/u);
    expect(() => validateAudioRange234({ startSeconds: 0, endSeconds: 0.04 }, 2, 48_000, 1)).toThrow(/VIDEO_AUDIO_RANGE/u);
    expect(() => validateAudioRange234({ startSeconds: 0, endSeconds: null }, 60, 96_000, 2)).toThrow(/VIDEO_AUDIO_MEMORY_LIMIT/u);
    expect(() => validateAudioRange234({ startSeconds: 0, endSeconds: null }, 1, 192_000, 1)).toThrow(/VIDEO_AUDIO_DECODE_UNSUPPORTED/u);
  });

  it("rejects forged RIFF size and mismatched PCM header even if the blob looks like a WAV", () => {
    const bytes = new ArrayBuffer(44 + 12);
    const data = new DataView(bytes);
    const mark = (offset: number, value: string) => [...value].forEach((char, index) => data.setUint8(offset + index, char.charCodeAt(0)));
    mark(0, "RIFF"); data.setUint32(4, bytes.byteLength - 8, true);
    mark(8, "WAVE"); mark(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
    data.setUint16(22, 1, true); data.setUint32(24, 48_000, true); data.setUint32(28, 96_000, true);
    data.setUint16(32, 2, true); data.setUint16(34, 16, true); mark(36, "data"); data.setUint32(40, 12, true);
    expect(() => verifyWav234(bytes, 48_000, 1, 6)).not.toThrow();
    data.setUint32(40, 10, true);
    expect(() => verifyWav234(bytes, 48_000, 1, 6)).toThrow(/VIDEO_AUDIO_OUTPUT_VERIFY/u);
  });

  it("supports immediate cancellation before opening a context or worker", async () => {
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(extractAudioWav234(fromFile("video-audio-234-two-tones.mp4"), { startSeconds: 0, endSeconds: null }, cancelled.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });

  it("writes REAL MP4-derived audio to a WAV independently probed as PCM16, retaining 440/880 Hz trim fidelity", () => {
    // FFmpeg is a TEST-ONLY independent AAC decoder. The deployed browser does not use
    // ffmpeg or claim that an OS-installed binary is available at runtime.
    const source = fileURLToPath(new URL("./video-audio-234-two-tones.mp4", import.meta.url));
    const pcmBytes = execFileSync("ffmpeg", ["-hide_banner", "-nostdin", "-v", "error", "-i", source,
      "-map", "0:a:0", "-ar", "48000", "-ac", "1", "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1"], { maxBuffer: 2 * 1024 * 1024 });
    const reader = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);
    const pcm = new Float32Array(reader.byteLength / 4);
    for (let index = 0; index < pcm.length; index++) pcm[index] = reader.getFloat32(index * 4, true);
    // FFmpeg's independent AAC decoder exposes 256 samples of codec padding;
    // encoded container duration is not a claim of sample-exact AAC boundaries.
    expect(pcm.length).toBeGreaterThanOrEqual(96_000);
    expect(pcm.length).toBeLessThanOrEqual(97_024);

    for (const [startFrame, expectedHz] of [[12_000, 440], [60_000, 880]] as const) {
      const frames = 24_000;
      const bytes = writeWav234({ kind: "write", channels: [pcm.slice(startFrame, startFrame + frames)], sampleRate: 48_000, frames });
      expect(() => verifyWav234(bytes, 48_000, 1, frames)).not.toThrow();
      const probed = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-f", "wav", "-show_entries",
        "stream=codec_name,sample_rate,channels,duration:format=duration", "-of", "json", "pipe:0"],
      { input: Buffer.from(bytes) }).toString("utf8"));
      expect(probed.streams[0]).toMatchObject({ codec_name: "pcm_s16le", sample_rate: "48000", channels: 1 });
      // A nonseekable ffprobe pipe reports duration N/A; WAV data chunk length
      // independently certifies 24000 samples / 48000 Hz = exactly 0.5 s.
      expect(new DataView(bytes).getUint32(40, true) / (48_000 * 2)).toBe(0.5);

      const view = new DataView(bytes);
      let crossings = 0;
      let energy = 0;
      const begin = 3500;
      const stop = 20000;
      let previous = view.getInt16(44 + begin * 2, true);
      for (let i = begin + 1; i < stop; i++) {
        const sample = view.getInt16(44 + i * 2, true);
        if (previous <= 0 && sample > 0) crossings++;
        energy += (sample / 32768) ** 2;
        previous = sample;
      }
      const measuredHz = crossings * 48_000 / (stop - begin);
      expect(measuredHz).toBeCloseTo(expectedHz, -1);
      expect(Math.sqrt(energy / (stop - begin))).toBeGreaterThan(0.03);
    }
  });
});
