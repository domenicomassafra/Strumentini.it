import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectMp4Local } from "../src/engines/video/mp4-inspection";

function fixture(name: string): Blob {
  const file = readFileSync(new URL(`../quality/fixtures/video-inspection/${name}`, import.meta.url));
  return new Blob([new Uint8Array(file).buffer], { type: "video/mp4" });
}

describe("232 — bounded, truthful MP4 container inspection", () => {
  it("inspects a real H.264 file with moov after mdat, proving FPS only from complete presentation timing", async () => {
    const source = fixture("video-12fps.mp4");
    const info = await inspectMp4Local(source);
    expect(info.container).toBe("iso-bmff-mp4");
    expect(info.bytes).toBe(source.size);
    expect(info).toMatchObject({ totalTracks: 1, videoTracks: 1, audioTracks: 0, durationSeconds: 1.25, containsMovieFragments: false });
    expect(info.tracks[0]).toMatchObject({ kind: "video", codecFourCc: "avc1", width: 64, height: 48, quarterTurnDegrees: 0, frameRate: 12, frameRateMode: "cfr" });
    expect(info.averageContainerBitrateBps).toBe(Math.round(source.size * 8 / 1.25));
    expect(info.warnings.join(" ")).toMatch(/CFR\/VFR restano sconosciuti per timing/u);
  });

  it("exposes both video and audio tracks rather than guessing from filename or MIME", async () => {
    const info = await inspectMp4Local(fixture("video-plus-audio.mp4"));
    expect(info.durationSeconds).toBeCloseTo(1.2, 2);
    expect(info).toMatchObject({ totalTracks: 2, videoTracks: 1, audioTracks: 1 });
    expect(info.tracks.find((track) => track.kind === "video")).toMatchObject({ codecFourCc: "avc1", width: 80, height: 60 });
    expect(info.tracks.find((track) => track.kind === "audio")?.codecFourCc).toBe("mp4a");
    expect(info.tracks.find((track) => track.kind === "video")).toMatchObject({ frameRate: 10, frameRateMode: "cfr" });
    expect(info.tracks.find((track) => track.kind === "audio")).toMatchObject({ frameRate: null, frameRateMode: "unknown" });
  });

  it("interprets a real QuickTime display-matrix quarter-turn and retains raw values", async () => {
    const info = await inspectMp4Local(fixture("video-rotated.mp4"));
    expect(info.tracks[0]?.kind).toBe("video");
    expect(info.tracks[0]?.matrix).toHaveLength(4);
    expect(info.tracks[0]?.quarterTurnDegrees).toBe(90);
    const opposite = await inspectMp4Local(fixture("video-rotated-minus90.mp4"));
    expect(opposite.tracks[0]?.quarterTurnDegrees).toBe(270);
  });

  it("does not mutate source bytes and reads only small metadata slices", async () => {
    const original = fixture("video-plus-audio.mp4");
    const originalBytes = new Uint8Array(await original.arrayBuffer());
    const requested: number[] = [];
    const source = new Proxy(original, {
      get(target, prop) {
        if (prop === "slice") return (begin: number, end: number) => {
          requested.push(end - begin);
          return target.slice(begin, end);
        };
        const val = Reflect.get(target, prop, target);
        return typeof val === "function" ? val.bind(target) : val;
      },
    });
    expect((await inspectMp4Local(source)).totalTracks).toBe(2);
    expect(Math.max(...requested)).toBeLessThan(8 * 1024 * 1024);
    expect(new Uint8Array(await original.arrayBuffer())).toEqual(originalBytes);
  });

  it.each(["", "not a video", "%PDF-1.7\n", "\0\0\0\x04ftypgarbage"])("fails closed on non-video or malformed MP4 %j", async (input) => {
    await expect(inspectMp4Local(new Blob([input]))).rejects.toThrow(/UNSUPPORTED_VIDEO_CONTAINER/u);
  });

  it("supports caller cancellation before reading container bytes", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(inspectMp4Local(fixture("video-plus-audio.mp4"), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("refuses corrupted atom size instead of interpreting partial metadata as a successful inspection", async () => {
    const raw = new Uint8Array(await fixture("video-plus-audio.mp4").arrayBuffer());
    // The first top-level atom is ftyp; invalidate its 32-bit size field.
    raw[0] = 0x7f;
    raw[1] = 0xff;
    raw[2] = 0xff;
    raw[3] = 0xff;
    await expect(inspectMp4Local(new Blob([raw]))).rejects.toThrow(/UNSUPPORTED_VIDEO_CONTAINER/u);
  });
});
