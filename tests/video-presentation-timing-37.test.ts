import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectMp4Local } from "../src/engines/video/mp4-inspection";
import { formatFrameRate } from "../src/components/tools/video/video-presentation";

const ROOT = resolve(import.meta.dirname, "../quality/fixtures/video-inspection");
const load = (name: string): Buffer => readFileSync(resolve(ROOT, name));
const inspect = (input: Uint8Array) => inspectMp4Local(new Blob([Uint8Array.from(input)], { type: "video/mp4" }));

/**
 * The FFmpeg corpus has moov after mdat, so extending stts/ctts changes only
 * bounded metadata bytes. This adversarial helper never changes encoded frames.
 */
function mutateMp4(base: Buffer, boxName: "stts" | "ctts", replacement: Buffer, add = false): Buffer {
  const original = Buffer.from(base);
  const match = original.indexOf(Buffer.from(boxName, "ascii"));
  if (!add && match < 4) throw new Error(`Missing box ${boxName}`);
  const stblIndex = original.indexOf(Buffer.from("stbl", "ascii"));
  const moovIndex = original.indexOf(Buffer.from("moov", "ascii"));
  expect(stblIndex).toBeGreaterThan(4);
  expect(moovIndex).toBeGreaterThan(4);
  expect(moovIndex).toBeGreaterThan(original.indexOf(Buffer.from("mdat", "ascii")));
  const parents = ["moov", "trak", "mdia", "minf", "stbl"].map((name) => {
    const index = original.indexOf(Buffer.from(name, "ascii"), moovIndex);
    if (index < 4) throw new Error(`Missing parent box ${name}`);
    return index - 4;
  });
  const originalBegin = add ? original.readUInt32BE(stblIndex - 4) + stblIndex - 4 : match - 4;
  const originalEnd = add ? originalBegin : originalBegin + original.readUInt32BE(originalBegin);
  const result = Buffer.concat([original.subarray(0, originalBegin), replacement, original.subarray(originalEnd)]);
  const delta = replacement.byteLength - (originalEnd - originalBegin);
  for (const position of parents) result.writeUInt32BE(original.readUInt32BE(position) + delta, position);
  return result;
}

function runBox(type: "ctts" | "stts", entries: readonly (readonly [number, number])[], version = 0): Buffer {
  const box = Buffer.alloc(16 + entries.length * 8);
  box.writeUInt32BE(box.length, 0);
  box.write(type, 4, 4, "ascii");
  box[8] = version;
  box.writeUInt32BE(entries.length, 12);
  entries.forEach(([samples, value], i) => {
    box.writeUInt32BE(samples, 16 + i * 8);
    if (type === "ctts" && version === 1) box.writeInt32BE(value, 20 + i * 8);
    else box.writeUInt32BE(value, 20 + i * 8);
  });
  return box;
}

function setField(base: Buffer, box: string, offsetFromFourCC: number, value: number): Buffer {
  const result = Buffer.from(base);
  const index = result.indexOf(Buffer.from(box, "ascii"));
  if (index < 4) throw new Error(`Missing ${box}`);
  result.writeUInt32BE(value, index + offsetFromFourCC);
  return result;
}

function vfrToCfrUsingCompositionOffsets(): Buffer {
  // Deliberately variable decode intervals but presentation PTS = n*1024.
  const altered = mutateMp4(load("video-12fps.mp4"), "stts",
    runBox("stts", [[5, 512], [5, 1536], [5, 1024]]));
  const offsets = [0, 512, 1024, 1536, 2048, 2560, 2048, 1536, 1024, 512, 0, 0, 0, 0, 0];
  const entries: [number, number][] = [];
  for (const offset of offsets) {
    if (entries.at(-1)?.[1] === offset) entries[entries.length - 1]![0] += 1;
    else entries.push([1, offset]);
  }
  return mutateMp4(altered, "ctts", runBox("ctts", entries), true);
}

describe("#037 sample-accurate, bounded MP4 presentation cadence (not a codec decoder)", () => {
  it("recognizes genuine 12 fps CFR and genuine FFmpeg presentation VFR from actual files", async () => {
    const cfr = await inspect(load("video-12fps.mp4"));
    const vfr = await inspect(load("video-vfr.mp4"));
    expect(cfr.tracks[0]).toMatchObject({
      kind: "video", frameRateMode: "cfr", frameRate: 12, decodeTiming: "constant-sample-deltas-observed",
    });
    expect(vfr.tracks[0]).toMatchObject({
      kind: "video", frameRateMode: "vfr", frameRate: null, decodeTiming: "variable-sample-deltas-observed",
    });
    expect(formatFrameRate(cfr.tracks[0]!)).toContain("12 fps (PTS verificati, CFR)");
    expect(formatFrameRate(vfr.tracks[0]!)).toMatch(/Intervalli PTS variabili \(VFR\); FPS medio non misurato/u);
    expect(vfr.warnings.join(" ")).toMatch(/sola stts/u);
  });

  it.skipIf(spawnSync("ffprobe", ["-version"]).status !== 0)(
    "cross-checks source presentation timestamps independently with real FFprobe", async () => {
      for (const [file, target] of [["video-12fps.mp4", "cfr"], ["video-vfr.mp4", "vfr"]] as const) {
        const output = execFileSync("ffprobe", [
          "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time",
          "-of", "csv=p=0", resolve(ROOT, file),
        ], { encoding: "utf8", timeout: 5_000 });
        const times = output.trim().split(/\s+/u).map(Number).sort((a, b) => a - b);
        expect(times.length).toBeGreaterThan(3);
        // FFprobe prints seconds rounded to six decimals: comparing at
        // microsecond precision would misclassify exact 1/12-second cadence.
        const intervals = times.slice(1).map((t, i) => Math.round((t - times[i]!) * 1_000));
        const deltas = new Set(intervals);
        expect(deltas.size === 1 ? "cfr" : "vfr").toBe(target);
        expect((await inspect(load(file))).tracks[0]?.frameRateMode).toBe(target);
      }
    }, 20_000,
  );

  it("does not confuse stts variation with VFR if nonnegative ctts yields exact CFR PTS", async () => {
    const track = (await inspect(vfrToCfrUsingCompositionOffsets())).tracks[0]!;
    expect(track.decodeTiming).toBe("variable-sample-deltas-observed");
    expect(track.frameRateMode).toBe("cfr");
    expect(track.frameRate).toBe(12);
  });

  it("does not confuse constant stts with CFR when ctts introduces PTS variation", async () => {
    const modified = mutateMp4(load("video-12fps.mp4"), "ctts",
      runBox("ctts", [[14, 0], [1, 128]]), true);
    const track = (await inspect(modified)).tracks[0]!;
    expect(track.decodeTiming).toBe("constant-sample-deltas-observed");
    expect(track.frameRateMode).toBe("vfr");
    expect(track.frameRate).toBeNull();
  });

  it.each([
    ["media-time edit", (data: Buffer) => setField(data, "elst", 16, 1024)],
    ["empty edit", (data: Buffer) => setField(data, "elst", 16, 0xffffffff)],
    ["unmatched edit duration", (data: Buffer) => setField(data, "elst", 12, 2000)],
    ["stsz count mismatch", (data: Buffer) => setField(data, "stsz", 12, 14)],
    ["mdhd timescale zero", (data: Buffer) => setField(data, "mdhd", 16, 0)],
    ["large sample-count bomb", (data: Buffer) => setField(data, "stts", 12, 100_001)],
    ["stsc malformed chunk mapping", (data: Buffer) => setField(data, "stsc", 20, 99)],
    ["stco chunk offset outside the file", (data: Buffer) => setField(data, "stco", 12, 0xffffffff)],
    ["ctts sample counts mismatch", (data: Buffer) => mutateMp4(data, "ctts", runBox("ctts", [[14, 0]]), true)],
    ["ctts nonzero origin", (data: Buffer) => mutateMp4(data, "ctts", runBox("ctts", [[15, 120]]), true)],
    ["ctts signed negative", (data: Buffer) => mutateMp4(data, "ctts", runBox("ctts", [[15, -120]], 1), true)],
    ["ctts duplicated", (data: Buffer) => {
      const once = mutateMp4(data, "ctts", runBox("ctts", [[15, 0]]), true);
      return mutateMp4(once, "ctts", runBox("ctts", [[15, 0]]), true);
    }],
  ] as const)("keeps presentation unknown under %s", async (_case, mutate) => {
    const track = (await inspect(mutate(load("video-12fps.mp4")))).tracks[0]!;
    expect(track.frameRateMode).toBe("unknown");
    expect(track.frameRate).toBeNull();
  });

  it("preserves unknown on real fragments and on extreme time-lapse source", async () => {
    const fragment = (await inspect(load("extension/video-fragmented.mp4"))).tracks[0]!;
    const hour = (await inspect(load("video-hour-sparse.mp4"))).tracks[0]!;
    expect(fragment.frameRateMode).toBe("unknown");
    expect(hour.frameRateMode).toBe("unknown");
    expect(hour.decodeTiming).toBe("constant-sample-deltas-observed");
  });

  it("treats a top-level moof as fragmented even if its moov has no mvex", async () => {
    const source = load("video-12fps.mp4");
    const moof = Buffer.alloc(8);
    moof.writeUInt32BE(8, 0);
    moof.write("moof", 4, "ascii");
    const result = await inspect(Buffer.concat([source, moof]));
    expect(result.containsMovieFragments).toBe(true);
    expect(result.durationSeconds).toBeNull();
    expect(result.tracks[0]?.frameRateMode).toBe("unknown");
    expect(result.tracks[0]?.frameRate).toBeNull();
  });

  it("only certifies video PTS in a multi-stream source, never derives audio FPS", async () => {
    const mixed = await inspect(load("video-multistream.mp4"));
    const videos = mixed.tracks.filter((track) => track.kind === "video");
    expect(videos.map((track) => [track.frameRateMode, track.frameRate])).toEqual([["cfr", 12], ["cfr", 6]]);
    const audio = mixed.tracks.filter((track) => track.kind === "audio");
    expect(audio).toHaveLength(1);
    expect(audio[0]?.frameRateMode).toBe("unknown");
    expect(audio[0]?.frameRate).toBeNull();
  });
});
