import { describe, expect, it } from "vitest";
import { parseSubtitles, processSubtitles } from "../src/engines/text-writing/subtitles";

describe("#037 subtitle timecode numeric safety", () => {
  it("refuses SRT hours that overflow safe millisecond arithmetic instead of serializing Infinity", () => {
    const hours = "9".repeat(310);
    const source = `1\n00:00:00,000 --> ${hours}:00:00,000\ntesto\n`;
    expect(() => parseSubtitles(source, "srt")).toThrow(/INVALID_SUBTITLE_MALFORMED_TIMING/);
    expect(() => processSubtitles({ text: source, sourceFormat: "srt", output: "srt" }))
      .toThrow(/INVALID_SUBTITLE_MALFORMED_TIMING/);
  });

  it("refuses finite but unsafe WebVTT timestamps beyond exact integer milliseconds", () => {
    const source = "WEBVTT\n\n00:00:00.000 --> 99999999999999:00:00.000\ntesto\n";
    expect(() => parseSubtitles(source, "vtt")).toThrow(/INVALID_SUBTITLE_MALFORMED_TIMING/);
  });

  it("refuses rescaling a safe source timestamp beyond exact millisecond precision", () => {
    const source = "1\n00:00:00,000 --> 2000000000:00:00,000\ntesto\n";
    expect(() => parseSubtitles(source, "srt")).not.toThrow();
    expect(() => processSubtitles({ text: source, sourceFormat: "srt", output: "srt", scale: 2 }))
      .toThrow(/INVALID_SUBTITLE_TIME_RANGE/);
  });

  it("retains exact ordinary millisecond times after rescale and offset", () => {
    const result = processSubtitles({
      text: "WEBVTT\n\n00:01.001 --> 00:02.222\nCiao\n", sourceFormat: "vtt", output: "srt",
      scale: 1.5, offsetMs: 125,
    });
    expect(result.cues[0]).toMatchObject({ startMs: 1627, endMs: 3458 });
    expect(result.output).toContain("00:00:01,627 --> 00:00:03,458");
  });
});
