import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectMp4Local } from "../src/engines/video/mp4-inspection";
import { parseSubtitles, processSubtitles } from "../src/engines/text-writing/subtitles";

const fixturePath = (name: string) => resolve(import.meta.dirname, "../quality/fixtures/video-inspection", name);
const cuesPath = resolve(import.meta.dirname, "../quality/fixtures/subtitle-transform/037-vfr-color-cues.srt");

function independentPts(file: string): number[] {
  // FFprobe is an external reference for actual packet presentation timestamps;
  // r_frame_rate and avg_frame_rate do not establish CFR/VFR.
  const output = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "packet=pts_time", "-of", "csv=p=0", fixturePath(file)], {
    encoding: "utf8", timeout: 5_000,
  });
  const pts = output.trim().split(/\s+/u).map(Number).sort((a, b) => a - b);
  expect(pts.every(Number.isFinite)).toBe(true);
  return pts;
}

async function inspect(file: string) {
  const bytes = readFileSync(fixturePath(file));
  return inspectMp4Local(new Blob([Uint8Array.from(bytes)], { type: "video/mp4" }));
}

describe("#037 real color-coded CFR/VFR PTS + aligned SRT acceptance", () => {
  it("independently probes every encoded frame and classifies real presentation cadence", async () => {
    const cfr = independentPts("037-pts-cfr-colors.mp4");
    const vfr = independentPts("037-pts-vfr-colors.mp4");
    expect(cfr).toEqual(Array.from({ length: 12 }, (_, i) => i / 4));
    expect(vfr).toEqual([0, 0.4, 1.12, 1.4]);
    expect(cfr.slice(1).every((time, i) => time - cfr[i]! === 0.25)).toBe(true);
    expect(new Set(vfr.slice(1).map((time, i) => Math.round((time - vfr[i]!) * 1_000))).size).toBe(3);

    const actualCfr = await inspect("037-pts-cfr-colors.mp4");
    const actualVfr = await inspect("037-pts-vfr-colors.mp4");
    expect(actualCfr.tracks[0]).toMatchObject({ kind: "video", codecFourCc: "avc1", frameRateMode: "cfr", frameRate: 4 });
    expect(actualVfr.tracks[0]).toMatchObject({ kind: "video", codecFourCc: "avc1", frameRateMode: "vfr", frameRate: null });
    expect(actualCfr.durationSeconds).toBe(3);
    expect(actualVfr.durationSeconds).toBeCloseTo(1.44, 4);
    expect(actualVfr.tracks[0]?.frameRate).toBeNull(); // no invented average fps
  });

  it("keeps the authored subtitle cues ordered with real frame boundaries and retains a deliberate overlap", () => {
    const source = readFileSync(cuesPath, "utf8");
    const packetTimesMs = independentPts("037-pts-vfr-colors.mp4").map((s) => Math.round(s * 1_000));
    const original = parseSubtitles(source, "srt");
    expect(original.cues.map((cue) => cue.startMs)).toEqual([0, 400, 1100, 1400]);
    expect(original.cues.map((cue) => cue.endMs)).toEqual([400, 1120, 1400, 1440]);
    expect(original.cues.map((cue) => cue.startMs - packetTimesMs[cue.sourceCue - 1]!)).toEqual([0, 0, -20, 0]);
    expect(original.cues[1]?.textLines).toEqual(["VERDE — é"]);

    const converted = processSubtitles({ text: source, sourceFormat: "auto", output: "vtt", readingSpeedCps: 17 });
    expect(converted.cueCount).toBe(4);
    expect(converted.overlapCount).toBe(1);
    expect(converted.readingSpeedIssueCount).toBe(1); // deliberate 40ms final cue, not an invented global rule
    expect(converted.diagnostics.find((diagnostic) => diagnostic.kind === "overlap"))
      .toMatchObject({ cue: 3, relatedCue: 2 });
    expect(converted.readingSpeedThresholdConfiguredBy).toBe("user");
    expect(converted.transcript).toBe("ROSSO\nVERDE — é\nBLU\nFine\n");
    const back = processSubtitles({ text: converted.output, sourceFormat: "vtt", output: "srt" });
    expect(back.cues.map(({ startMs, endMs, textLines }) => [startMs, endMs, textLines]))
      .toEqual(original.cues.map(({ startMs, endMs, textLines }) => [startMs, endMs, textLines]));
  });

  it("applies bounded rescale then offset to the authored corpus without rearranging subtitle text", () => {
    const result = processSubtitles({ text: readFileSync(cuesPath, "utf8"), output: "srt", scale: 1.25, offsetMs: 85 });
    expect(result.transformOrder).toBe("rescale-then-offset");
    expect(result.cues.map((cue) => [cue.startMs, cue.endMs])).toEqual([
      [85, 585], [585, 1485], [1460, 1835], [1835, 1885],
    ]);
    expect(result.cues.map((cue) => cue.textLines[0])).toEqual(["ROSSO", "VERDE — é", "BLU", "Fine"]);
    expect(result.overlapCount).toBe(1);
    expect(result.readingSpeedThresholdSource).toMatch(/Netflix Italian Timed Text Style Guide/u);
  });
});
