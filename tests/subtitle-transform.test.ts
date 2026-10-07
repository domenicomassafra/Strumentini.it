import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseSubtitles,
  processSubtitles,
  serializeSubtitles,
  subtitleTranscript,
} from "../src/engines/text-writing";

const SRT = `1
00:00:01,000 --> 00:00:03,000
Ciao, mondo 👋
Seconda riga

2
00:00:03,500 --> 00:00:05,000
Perché l’accento resta.
`;

const VTT = `WEBVTT

intro
00:00:01.000 --> 00:00:03.000
Ciao, mondo 👋
Seconda riga

00:03.500 --> 00:05.000
Perché l’accento resta.
`;

describe("ticket 233 subtitle transform", () => {
  it("matches the hand-worked subtitle fixture corpus", async () => {
    const fixture = JSON.parse(await readFile(resolve("quality/fixtures/subtitle-transform/vectors.json"), "utf8")) as {
      cases: Array<{ format: "srt" | "vtt"; input: string; cue_count: number; transcript: string }>;
      invalid_cases: Array<{ format: "srt" | "vtt"; input: string; error: string }>;
    };
    for (const vector of fixture.cases) {
      const parsed = parseSubtitles(vector.input, vector.format);
      expect(parsed.cues).toHaveLength(vector.cue_count);
      expect(subtitleTranscript(parsed.cues)).toBe(vector.transcript);
    }
    for (const vector of fixture.invalid_cases) {
      expect(() => parseSubtitles(vector.input, vector.format)).toThrow(vector.error);
    }
  });

  it("round-trips SRT to VTT to SRT preserving cue order, timing and Unicode text", () => {
    const parsed = parseSubtitles(SRT, "srt");
    const asVtt = serializeSubtitles(parsed.cues, "vtt");
    const reparsedVtt = parseSubtitles(asVtt, "vtt");
    const backToSrt = serializeSubtitles(reparsedVtt.cues, "srt");
    const reparsedSrt = parseSubtitles(backToSrt, "srt");

    expect(reparsedSrt.cues.map((cue) => [cue.startMs, cue.endMs, cue.textLines])).toEqual(
      parsed.cues.map((cue) => [cue.startMs, cue.endMs, cue.textLines]),
    );
    expect(asVtt).toContain("Ciao, mondo 👋\nSeconda riga");
    expect(backToSrt).toContain("Perché l’accento resta.");
  });

  it("parses the supported VTT subset and preserves cue order/text when converting to SRT", () => {
    const result = processSubtitles({ text: VTT, sourceFormat: "auto", output: "srt" });
    expect(result.sourceFormat).toBe("vtt");
    expect(result.cues.map((cue) => cue.textLines.join("\n"))).toEqual([
      "Ciao, mondo 👋\nSeconda riga",
      "Perché l’accento resta.",
    ]);
    expect(result.output).toMatch(/^1\n00:00:01,000 --> 00:00:03,000/u);
  });

  it("normalizes CRLF structure without changing Unicode cue content", () => {
    const input = "1\r\n00:00:01,000 --> 00:00:02,000\r\ne\u0301 — 👩🏽‍💻\r\n";
    const parsed = parseSubtitles(input, "srt");
    expect(parsed.cues[0]?.textLines).toEqual(["e\u0301 — 👩🏽‍💻"]);
    expect(serializeSubtitles(parsed.cues, "vtt")).toContain("e\u0301 — 👩🏽‍💻");
  });

  it("exports a clean transcript without timestamps while preserving cue sequence", () => {
    const parsed = parseSubtitles(SRT, "srt");
    expect(subtitleTranscript(parsed.cues)).toBe("Ciao, mondo 👋 Seconda riga\nPerché l’accento resta.\n");
    const result = processSubtitles({ text: SRT, output: "transcript" });
    expect(result.output).toBe(result.transcript);
    expect(result.output).not.toContain("-->");
  });

  it("refuses negative offsets or clamps cue starts to zero while preserving duration", () => {
    expect(() => processSubtitles({
      text: SRT,
      output: "srt",
      offsetMs: -1_500,
      negativeOffsetPolicy: "refuse",
    })).toThrow("INVALID_SUBTITLE_NEGATIVE_OFFSET|line=2|cue=1");

    const clamped = processSubtitles({
      text: SRT,
      output: "srt",
      offsetMs: -1_500,
      negativeOffsetPolicy: "clamp",
    });
    expect(clamped.clampedCueCount).toBe(1);
    expect(clamped.cues[0]).toMatchObject({ startMs: 0, endMs: 2000 });
    expect(clamped.cues[1]).toMatchObject({ startMs: 2000, endMs: 3500 });
    expect(clamped.negativeOffsetPolicy).toBe("clamp");
  });

  it("rescales timings before applying offset and refuses factors that collapse a cue below 1 ms", () => {
    const transformed = processSubtitles({ text: SRT, output: "vtt", scale: 2, offsetMs: 500 });
    expect(transformed.transformOrder).toBe("rescale-then-offset");
    expect(transformed.cues[0]).toMatchObject({ startMs: 2500, endMs: 6500 });
    expect(transformed.cues[1]).toMatchObject({ startMs: 7500, endMs: 10500 });

    const tiny = `1\n00:00:00,001 --> 00:00:00,002\nx\n`;
    expect(() => processSubtitles({ text: tiny, scale: 0.01 })).toThrow("INVALID_SUBTITLE_RESCALE_COLLAPSE|line=2|cue=1");
  });

  it("reports overlap and reading speed with configurable, source-labelled thresholds", () => {
    const input = `1
00:00:00,000 --> 00:00:01,000
1234567890

2
00:00:00,900 --> 00:00:02,000
abcdefghij
`;
    const reference = processSubtitles({ text: input, output: "vtt" });
    expect(reference.readingSpeedThresholdCps).toBe(17);
    expect(reference.readingSpeedThresholdConfiguredBy).toBe("reference-default");
    expect(reference.readingSpeedThresholdSource).toMatch(/Netflix Italian Timed Text Style Guide/u);
    expect(reference.overlapCount).toBe(1);

    const configured = processSubtitles({ text: input, output: "vtt", readingSpeedCps: 5 });
    expect(configured.readingSpeedThresholdConfiguredBy).toBe("user");
    expect(configured.readingSpeedThresholdSource).toMatch(/User-configured threshold: 5/u);
    expect(configured.readingSpeedIssueCount).toBe(2);
    expect(configured.diagnostics.some((item) => item.kind === "overlap" && item.cue === 2 && item.relatedCue === 1)).toBe(true);
  });

  it("reports out-of-order cues without reordering them", () => {
    const input = `1
00:00:05,000 --> 00:00:06,000
prima

2
00:00:02,000 --> 00:00:03,000
seconda
`;
    const result = processSubtitles({ text: input, output: "srt" });
    expect(result.cues.map((cue) => cue.textLines[0])).toEqual(["prima", "seconda"]);
    expect(result.outOfOrderCount).toBe(1);
    expect(result.diagnostics.some((item) => item.kind === "out-of-order" && item.cue === 2)).toBe(true);
  });

  it("reports exact malformed timing location and rejects unsupported VTT settings/blocks", () => {
    const malformed = `1
00:00:01,000 --> nope
testo
`;
    expect(() => parseSubtitles(malformed, "srt")).toThrow("INVALID_SUBTITLE_MALFORMED_TIMING|line=2|cue=1");

    const settings = `WEBVTT

00:00:01.000 --> 00:00:02.000 align:start
testo
`;
    expect(() => parseSubtitles(settings, "vtt")).toThrow("INVALID_SUBTITLE_UNSUPPORTED_CUE_SETTINGS|line=3|cue=1");

    const style = `WEBVTT

STYLE
::cue { color: red; }
`;
    expect(() => parseSubtitles(style, "vtt")).toThrow("INVALID_SUBTITLE_UNSUPPORTED_BLOCK|line=3|cue=1");
  });
});
