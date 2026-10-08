import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectMp4Local } from "../src/engines/video/mp4-inspection";

/** Real ISO BMFF bytes from reproducible FFmpeg commands, NOT physical camera recordings. */
const cases = [
  { name: "video-hevc-hvc1.mp4", codec: "hvc1", fragmented: false, duration: 1 },
  { name: "video-fragmented.mp4", codec: "avc1", fragmented: true, duration: null },
] as const;
const path = (name: string) => new URL(`../quality/fixtures/video-inspection/extension/${name}`, import.meta.url);
const hasProbe = spawnSync("ffprobe", ["-version"], { encoding: "utf8" }).status === 0;

describe("STR-232 — independently referenced HEVC and fragmented MP4 limits", () => {
  it.each(cases)("inspects the real $name conservatively using bounded reads", async ({ name, codec, fragmented, duration }) => {
    const bytes = readFileSync(path(name));
    const requested: number[] = [];
    const blob = new Blob([bytes]);
    const audited = new Proxy(blob, { get(target, key) {
      if (key === "slice") return (from: number, to: number) => {
        requested.push(to - from);
        return target.slice(from, to);
      };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    } });
    const metadata = await inspectMp4Local(audited);
    expect(metadata).toMatchObject({
      videoTracks: 1, audioTracks: 0, containsMovieFragments: fragmented, durationSeconds: duration,
      tracks: [{ kind: "video", codecFourCc: codec, width: 64, height: 48, frameRate: null, frameRateMode: "unknown" }],
    });
    expect(metadata.averageContainerBitrateBps === null).toBe(fragmented);
    expect(requested.length).toBeGreaterThan(0);
    expect(Math.max(...requested)).toBeLessThan(8 * 1024 * 1024);
    if (fragmented) {
      expect(metadata.tracks[0]?.decodeTiming).toBe("not-proven");
      expect(metadata.warnings.join(" ")).toMatch(/MP4 frammentato/u);
    }
  });

  it.skipIf(!hasProbe)("independent FFprobe confirms two real formats and their declared duration", () => {
    for (const entry of cases) {
      const result = JSON.parse(execFileSync("ffprobe", [
        "-v", "error", "-show_entries", "format=duration,size:stream=codec_type,codec_name,codec_tag_string,width,height",
        "-of", "json", path(entry.name).pathname,
      ], { encoding: "utf8" })) as {
        format: { duration: string }; streams: Array<{ codec_type: string; codec_name: string; codec_tag_string: string; width: number; height: number }>;
      };
      expect(Number(result.format.duration)).toBeCloseTo(1, 3);
      expect(result.streams).toHaveLength(1);
      expect(result.streams[0]).toMatchObject({
        codec_type: "video", codec_name: entry.codec === "hvc1" ? "hevc" : "h264",
        codec_tag_string: entry.codec, width: 64, height: 48,
      });
    }
  });
});
