import { describe, expect, it } from "vitest";
import {
  bpmFromTapTimes,
  chooseSupportedRecorderMimeType,
  deriveRecordedBlobType,
  extensionForRecordedMimeType,
  generateNoiseSamples,
  italianVoices,
  pauseRecordingClock,
  recordingDurationMs,
  resumeRecordingClock,
  rmsAudioLevel,
  startRecordingClock,
  validateAudioGeneratorSettings,
  validateSpeechControls,
} from "../src/engines/browser-audio";

describe("browser audio utilities", () => {
  it("bounds tone/metronome/noise settings and derives tap tempo", () => {
    expect(validateAudioGeneratorSettings({ mode: "tone", frequencyHz: 440, level: 0.05, durationSeconds: 2 })).toMatchObject({ frequencyHz: 440 });
    expect(validateAudioGeneratorSettings({ mode: "metronome", bpm: 120, level: 0.05, durationSeconds: 0 })).toMatchObject({ bpm: 120 });
    expect(bpmFromTapTimes([0, 500, 1000, 1500])).toBe(120);
    expect(() => validateAudioGeneratorSettings({ mode: "tone", frequencyHz: 10, level: 0.05, durationSeconds: 0 })).toThrow("INVALID_TONE_FREQUENCY");
    expect(() => validateAudioGeneratorSettings({ mode: "metronome", bpm: 500, level: 0.05, durationSeconds: 0 })).toThrow("INVALID_METRONOME_BPM");
    expect(() => validateAudioGeneratorSettings({ mode: "noise", noiseKind: "white", level: 0.5, durationSeconds: 0 })).toThrow("INVALID_AUDIO_LEVEL");
  });

  it("generates bounded deterministic test noise with an injected source", () => {
    let value = 0;
    const random = () => (value = (value + 0.173) % 1);
    for (const kind of ["white", "pink", "brown"] as const) {
      const samples = generateNoiseSamples(kind, 512, random);
      expect(samples).toHaveLength(512);
      expect([...samples].every((sample) => Number.isFinite(sample) && sample >= -1 && sample <= 1)).toBe(true);
    }
  });

  it("uses only runtime voices and filters Italian language tags", () => {
    const voices = [
      { voiceURI: "a", name: "Italiano", lang: "it-IT", localService: true },
      { voiceURI: "b", name: "English", lang: "en-US", localService: true },
      { voiceURI: "c", name: "Italiano CH", lang: "it-CH", localService: false },
    ];
    expect(italianVoices(voices).map((voice) => voice.voiceURI)).toEqual(["a", "c"]);
    expect(validateSpeechControls({ rate: 1.25, pitch: 0.8 })).toEqual({ rate: 1.25, pitch: 0.8 });
    expect(() => validateSpeechControls({ rate: 3, pitch: 1 })).toThrow("INVALID_SPEECH_RATE");
  });

  it("selects only a MIME reported by the runtime and derives Blob facts from produced data", () => {
    const probes: string[] = [];
    const selected = chooseSupportedRecorderMimeType((mimeType) => {
      probes.push(mimeType);
      return mimeType === "audio/ogg;codecs=opus";
    });
    expect(selected).toBe("audio/ogg;codecs=opus");
    expect(probes).toContain("audio/ogg;codecs=opus");
    expect(chooseSupportedRecorderMimeType(() => false)).toBeNull();
    expect(chooseSupportedRecorderMimeType(undefined)).toBeNull();

    const chunks = [
      new Blob(["one"], { type: "audio/ogg;codecs=opus" }),
      new Blob(["two"], { type: "audio/ogg;codecs=opus" }),
    ];
    expect(deriveRecordedBlobType(chunks, "audio/webm")).toBe("audio/ogg;codecs=opus");
    expect(deriveRecordedBlobType([], "audio/mp4")).toBe("audio/mp4");
    expect(extensionForRecordedMimeType("audio/ogg;codecs=opus")).toBe("ogg");
    expect(extensionForRecordedMimeType("audio/unknown")).toBe("bin");
  });

  it("measures active recording duration from monotonic event timestamps and excludes pauses", () => {
    let clock = startRecordingClock(100);
    expect(recordingDurationMs(clock, 350)).toBe(250);
    clock = pauseRecordingClock(clock, 400);
    expect(recordingDurationMs(clock, 900)).toBe(300);
    clock = resumeRecordingClock(clock, 1_000);
    expect(recordingDurationMs(clock, 1_250)).toBe(550);
    clock = pauseRecordingClock(clock, 1_300);
    expect(clock.elapsedMs).toBe(600);
    expect(() => recordingDurationMs(startRecordingClock(500), 499)).toThrow("NON_MONOTONIC_RECORDER_CLOCK");
  });

  it("computes a bounded RMS microphone level", () => {
    expect(rmsAudioLevel(new Float32Array([0, 0, 0]))).toBe(0);
    expect(rmsAudioLevel(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rmsAudioLevel(new Float32Array([2, -2]))).toBe(1);
    expect(rmsAudioLevel(new Float32Array([Number.NaN]))).toBe(0);
  });
});
