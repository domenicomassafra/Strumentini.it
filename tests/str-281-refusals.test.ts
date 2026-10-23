import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectImageHeader } from "../src/engines/image/format";
import { preflightAllocation } from "../src/engines/image/policy";
import { resizeImageLocal } from "../src/tools/image-resize/module";
import { planAudioTimeline231, renderAudioTimeline231 } from "../src/engines/browser-audio/timeline-231";
import { pcm16Wav231 } from "./fixtures/audio-dsp-231-corpus";

describe("STR-281: heavy-tool refusals retain the original input", () => {
  it("refuses incomplete image headers without changing the original file", () => {
    const bytes = readFileSync(new URL("../quality/fixtures/image-metadata/corrupt-truncated.png", import.meta.url));
    const source = Buffer.from(bytes);
    expect(() => inspectImageHeader(new Uint8Array(bytes))).toThrow(/TRUNCATED_IMAGE/u);
    expect(bytes).toEqual(source);
  });

  it("refuses a decoded image memory overrun before work, retaining its selected bytes", () => {
    const bytes = readFileSync(new URL("../quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png", import.meta.url));
    const source = Buffer.from(bytes);
    expect(() => preflightAllocation(bytes.length, 4000, 4000, 4000, 4000)).toThrow(/MEMORY_LIMIT/u);
    expect(bytes).toEqual(source);
  });

  it("rejects a cancelled image job before browser APIs, preserving its File", async () => {
    const bytes = readFileSync(new URL("../quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png", import.meta.url));
    const file = new File([Uint8Array.from(bytes)], "origine.png", { type: "image/png" });
    const before = Buffer.from(await file.arrayBuffer());
    const cancellation = new AbortController();
    cancellation.abort();
    await expect(resizeImageLocal({ file, width: 2, height: 3, fit: "contain", outputMime: "image/jpeg", quality: 0.8 }, cancellation.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(Buffer.from(await file.arrayBuffer())).toEqual(before);
  });

  it("refuses invalid and cancelled WAV edits without modifying the source PCM", () => {
    const original = pcm16Wav231([[0, 1000, -1000, 0]]);
    const before = original.slice();
    const edits = [{ sourceIndex: 0, startFrame: 0, endFrame: 4, gain: 1, fadeInFrames: 0, fadeOutFrames: 0 }];
    expect(() => planAudioTimeline231([original], [{ ...edits[0]!, endFrame: 99 }])).toThrow(/AUDIO_231_INVALID_RANGE/u);
    const cancellation = new AbortController();
    cancellation.abort();
    expect(() => renderAudioTimeline231([original], edits, { signal: cancellation.signal }))
      .toThrowError(expect.objectContaining({ name: "AbortError" }));
    expect(original).toEqual(before);
  });
});
