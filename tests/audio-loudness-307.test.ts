import { describe, expect, it } from "vitest";
import { analyzeLoudness307 } from "../src/engines/browser-audio/loudness-307";

function sine(seconds: number, amplitude: number, frequency = 997): Float32Array {
  const frames = Math.round(seconds * 48_000);
  return Float32Array.from({ length: frames }, (_, index) => amplitude * Math.sin(2 * Math.PI * frequency * index / 48_000));
}

describe("307 — bounded 48 kHz BS.1770/Tech 3341 subset", () => {
  it("reproduces the 997 Hz -3.01 LKFS monophonic programme reference within measured tolerance", () => {
    const x = sine(4, 1);
    const result = analyzeLoudness307([x], 48_000);
    expect(result.integratedLufs).toBeCloseTo(-3.01, 1);
    expect(result.momentaryLufs).toBeCloseTo(-3.01, 1);
    expect(result.shortTermLufs).toBeCloseTo(-3.01, 1);
    expect(result.samplePeakDbfs).toBeCloseTo(0, 4);
    expect(result.relativeGatedBlocks).toBe(result.absoluteGatedBlocks);
    expect(result.channelCount).toBe(1);
  });

  it("uses linear power, not average of channel decibels, for stereo", () => {
    const mono = sine(4, 0.1);
    const one = analyzeLoudness307([mono], 48_000);
    const two = analyzeLoudness307([mono, mono], 48_000);
    expect(one.integratedLufs).toBeCloseTo(-23.01, 1);
    expect(two.integratedLufs! - one.integratedLufs!).toBeCloseTo(10 * Math.log10(2), 3);
    expect(two.samplePeakDbfs).toBeCloseTo(-20, 3);
  });

  it("does not invent loudness for digital silence", () => {
    const s = analyzeLoudness307([new Float32Array(48000)], 48_000);
    expect(s.integratedLufs).toBeNull();
    expect(s.momentaryLufs).toBeNull();
    expect(s.samplePeakDbfs).toBeNull();
    expect(s.absoluteGatedBlocks).toBe(0);
    expect(s.relativeGatedBlocks).toBe(0);
  });

  it("recomputes relative gating instead of weighting long pauses equally with audible content", () => {
    const quiet = new Float32Array(48_000 * 8);
    quiet.set(sine(4, 0.2), 0);
    const gated = analyzeLoudness307([quiet], 48_000);
    const steady = analyzeLoudness307([sine(4, 0.2)], 48_000);
    expect(Math.abs(gated.integratedLufs! - steady.integratedLufs!)).toBeLessThan(0.6);
    expect(gated.relativeGatedBlocks).toBeLessThan(gated.absoluteGatedBlocks);
  });

  it("rejects unproven layouts, out-of-bounds frames, corrupt PCM and cancellation", () => {
    const good = sine(1, 0.2);
    expect(() => analyzeLoudness307([good], 44_100)).toThrow(/AUDIO_UNSUPPORTED_LAYOUT/u);
    expect(() => analyzeLoudness307([good, good, good], 48000)).toThrow(/AUDIO_UNSUPPORTED_LAYOUT/u);
    expect(() => analyzeLoudness307([new Float32Array(1200)], 48000)).toThrow(/AUDIO_LIMIT/u);
    expect(() => analyzeLoudness307([good, new Float32Array(30)], 48000)).toThrow(/AUDIO_LIMIT/u);
    const bad = good.slice(); bad[0] = NaN;
    expect(() => analyzeLoudness307([bad], 48000)).toThrow(/AUDIO_INVALID_SIGNAL/u);
    const abort = new AbortController(); abort.abort();
    expect(() => analyzeLoudness307([good], 48000, abort.signal)).toThrowError(expect.objectContaining({ name: "AbortError" }));
  });
});
