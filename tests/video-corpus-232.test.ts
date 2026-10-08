import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectMp4Local } from "../src/engines/video/mp4-inspection";

const root = resolve(import.meta.dirname, "..");
const fixtureDir = resolve(root, "quality/fixtures/video-inspection");
const vectors = JSON.parse(readFileSync(resolve(fixtureDir, "vectors.json"), "utf8")) as {
  files: readonly {
    path: string;
    duration_seconds: number;
    video_tracks: number;
    audio_tracks: number;
    frame_rate_claim: "unknown";
    decode_timing_evidence?: "constant-sample-deltas-observed" | "variable-sample-deltas-observed";
    video_packets?: number | readonly number[];
    packet_duration_values_ffprobe_seconds?: readonly number[];
    video_dimensions?: readonly (readonly number[])[];
  }[];
};
const named = new Map(vectors.files.map((entry) => [basename(entry.path), entry]));
const video = (name: string) => {
  const bytes = readFileSync(resolve(fixtureDir, name));
  return new Blob([new Uint8Array(bytes)], { type: "video/mp4" });
};
const ffprobeAvailable = spawnSync("ffprobe", ["-version"], { encoding: "utf8" }).status === 0;

describe("STR-232 — independently referenced ISO BMFF corpus", () => {
  it.each([
    "video-12fps.mp4",
    "video-plus-audio.mp4",
    "video-rotated.mp4",
    "video-rotated-minus90.mp4",
    "video-vfr.mp4",
    "video-multistream.mp4",
    "video-hour-sparse.mp4",
  ])("checks actual MP4 metadata against the pinned FFprobe observation for %s", async (name) => {
    const expected = named.get(name);
    expect(expected).toBeDefined();
    const metadata = await inspectMp4Local(video(name));
    expect(metadata.durationSeconds).toBeCloseTo(expected!.duration_seconds, 3);
    expect(metadata.videoTracks).toBe(expected!.video_tracks);
    expect(metadata.audioTracks).toBe(expected!.audio_tracks);
    for (const track of metadata.tracks) {
      expect(track.frameRate).toBeNull();
      expect(track.frameRateMode).toBe("unknown");
    }
    const evidence = expected!.decode_timing_evidence;
    if (evidence) expect(metadata.tracks.find((track) => track.kind === "video")?.decodeTiming).toBe(evidence);
    if (expected!.video_dimensions) {
      const dimensions = metadata.tracks.filter((track) => track.kind === "video")
        .map((track) => [track.width, track.height]);
      expect(dimensions).toEqual(expected!.video_dimensions);
    }
  });

  it("distinguishes varying decode deltas from constant decode deltas without claiming CFR/VFR", async () => {
    const vfr = await inspectMp4Local(video("video-vfr.mp4"));
    const cfr = await inspectMp4Local(video("video-12fps.mp4"));
    const hour = await inspectMp4Local(video("video-hour-sparse.mp4"));
    expect(vfr.tracks[0]?.decodeTiming).toBe("variable-sample-deltas-observed");
    expect(cfr.tracks[0]?.decodeTiming).toBe("constant-sample-deltas-observed");
    expect(hour.tracks[0]?.decodeTiming).toBe("constant-sample-deltas-observed");
    expect(hour.durationSeconds).toBe(3600);
    expect(hour.tracks[0]?.frameRate).toBeNull();
    expect([vfr, cfr, hour].every((entry) => entry.tracks[0]?.frameRateMode === "unknown")).toBe(true);
  });

  it.skipIf(!ffprobeAvailable)("reprobes all seven fixture streams using the independent FFprobe binary", () => {
    for (const entry of vectors.files) {
      const file = resolve(root, entry.path);
      const result = JSON.parse(execFileSync("ffprobe", [
        "-v", "error", "-show_entries",
        "format=duration:stream=index,codec_type,codec_name,width,height", "-of", "json", file,
      ], { encoding: "utf8" })) as {
        streams: readonly { codec_type: string; width?: number; height?: number }[];
        format: { duration: string };
      };
      expect(Number(result.format.duration)).toBeCloseTo(entry.duration_seconds, 3);
      expect(result.streams.filter((stream) => stream.codec_type === "video")).toHaveLength(entry.video_tracks);
      expect(result.streams.filter((stream) => stream.codec_type === "audio")).toHaveLength(entry.audio_tracks);
      if (entry.video_dimensions) {
        expect(result.streams.filter((stream) => stream.codec_type === "video")
          .map(({ width, height }) => [width, height])).toEqual(entry.video_dimensions);
      }
    }
    for (const filename of ["video-12fps.mp4", "video-vfr.mp4", "video-hour-sparse.mp4"]) {
      const entry = named.get(filename)!;
      const packets = execFileSync("ffprobe", [
        "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=duration_time",
        "-of", "csv=p=0", resolve(fixtureDir, filename),
      ], { encoding: "utf8" }).trim().split(/\s+/u).map(Number);
      if (typeof entry.video_packets === "number") expect(packets).toHaveLength(entry.video_packets);
      const unique = [...new Set(packets)].sort((a, b) => a - b);
      const pinned = entry.packet_duration_values_ffprobe_seconds;
      if (pinned) {
        expect(unique).toHaveLength(pinned.length);
        unique.forEach((value, index) => expect(value).toBeCloseTo(pinned[index]!, 5));
      } else expect(unique).toHaveLength(1);
    }
    for (const [filename, degrees] of [["video-rotated.mp4", 90], ["video-rotated-minus90.mp4", -90]] as const) {
      const rotation = execFileSync("ffprobe", [
        "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream_side_data=rotation", "-of", "compact",
        resolve(fixtureDir, filename),
      ], { encoding: "utf8" }).match(/rotation=(-?\d+)/u)?.[1];
      expect(Number(rotation)).toBe(degrees);
    }
  }, 120_000);
});

describe("STR-232 — bounded reading under hostile declared media size", () => {
  it("skips a virtual 5 GiB mdat without reading its content, then parses the real moov", async () => {
    const real = readFileSync(resolve(fixtureDir, "video-12fps.mp4"));
    const ftypSize = real.readUInt32BE(0);
    const ftyp = real.subarray(0, ftypSize);
    const moovTypeAt = real.indexOf("moov");
    expect(moovTypeAt).toBeGreaterThan(ftypSize);
    const moovStart = moovTypeAt - 4;
    const moovLength = real.readUInt32BE(moovStart);
    const moov = real.subarray(moovStart, moovStart + moovLength);
    const mdatSize = 5 * 1024 * 1024 * 1024;
    const mdatHeader = Buffer.alloc(16);
    mdatHeader.writeUInt32BE(1, 0);
    mdatHeader.write("mdat", 4, "ascii");
    mdatHeader.writeBigUInt64BE(BigInt(mdatSize), 8);
    const moovOffset = ftypSize + mdatSize;
    const reads: { from: number; length: number }[] = [];
    const virtual = new Proxy(new Blob(), {
      get(target, prop) {
        if (prop === "size") return moovOffset + moov.length;
        if (prop === "slice") return (from: number, to: number) => {
          reads.push({ from, length: to - from });
          const end = to;
          if (from >= 0 && end <= ftypSize) return new Blob([ftyp.subarray(from, to)]);
          if (from >= ftypSize && end <= ftypSize + 16) return new Blob([mdatHeader.subarray(from - ftypSize, to - ftypSize)]);
          if (from >= moovOffset && end <= moovOffset + moov.length) return new Blob([moov.subarray(from - moovOffset, to - moovOffset)]);
          throw new Error(`Unexpected read into huge mdat at ${from}, len ${to - from}`);
        };
        const result = Reflect.get(target, prop, target);
        return typeof result === "function" ? result.bind(target) : result;
      },
    });
    const result = await inspectMp4Local(virtual);
    expect(result.durationSeconds).toBe(1.25);
    expect(result.bytes).toBe(moovOffset + moov.length);
    expect(reads.some(({ from }) => from === moovOffset)).toBe(true);
    expect(reads.every(({ length }) => length <= 8 * 1024 * 1024)).toBe(true);
    expect(reads.reduce((total, { length }) => total + length, 0)).toBeLessThan(1024 * 1024);
  });

  it("rejects excessive moov size from its header before allocating the declared body", async () => {
    const real = readFileSync(resolve(fixtureDir, "video-12fps.mp4"));
    const ftypSize = real.readUInt32BE(0);
    const ftyp = real.subarray(0, ftypSize);
    const moovLength = 8 * 1024 * 1024 + 1;
    const header = Buffer.alloc(16);
    header.writeUInt32BE(moovLength, 0);
    header.write("moov", 4, "ascii");
    let maxRead = 0;
    const virtual = new Proxy(new Blob(), {
      get(target, prop) {
        if (prop === "size") return ftypSize + moovLength;
        if (prop === "slice") return (from: number, to: number) => {
          maxRead = Math.max(maxRead, to - from);
          if (to <= ftypSize) return new Blob([ftyp.subarray(from, to)]);
          if (from === ftypSize && to === ftypSize + 16) return new Blob([header]);
          throw new Error("Movie body must not be accessed when moov size exceeds limit");
        };
        const result = Reflect.get(target, prop, target);
        return typeof result === "function" ? result.bind(target) : result;
      },
    });
    await expect(inspectMp4Local(virtual)).rejects.toThrow(/8 MiB budget/u);
    expect(maxRead).toBeLessThanOrEqual(16);
  });

  it("does not interpret malformed zero-sample decode runs as CFR or VFR evidence", async () => {
    const bytes = Buffer.from(await video("video-12fps.mp4").arrayBuffer());
    const atomType = bytes.indexOf("stts");
    expect(atomType).toBeGreaterThan(4);
    bytes.writeUInt32BE(0, atomType + 12); // first stts run sample_count = 0
    const inspected = await inspectMp4Local(new Blob([bytes]));
    expect(inspected.tracks[0]?.decodeTiming).toBe("not-proven");
    expect(inspected.tracks[0]?.frameRate).toBeNull();
    expect(inspected.tracks[0]?.frameRateMode).toBe("unknown");
  });
});
