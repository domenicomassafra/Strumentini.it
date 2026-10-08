import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { planContactFrames308, verifyPresentedFrame308, packageContactSheet308 } from "../src/engines/video/contact-sheet-308";
import { inspectMp4Local } from "../src/engines/video/mp4-inspection";
import type { ContactFrame308 } from "../src/engines/video/contact-sheet-308";
import type { VideoFrame305Result } from "../src/engines/video/frame-extract-305";

const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/+iQAAAAASUVORK5CYII=", "base64");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("#308: deterministic, presented-time-backed contact sheet", () => {
  it("plans bounded stable middle-of-segment timestamps (no missing/end frame)", () => {
    expect(planContactFrames308(2, 4)).toEqual([0.4, 0.8, 1.2, 1.6]);
    expect(planContactFrames308(1, 2)).toEqual([0.333, 0.667]);
    for (const [duration, count] of [[0.01, 4], [0, 4], [3601, 4], [1, 1], [1, 9], [NaN, 3], [1, 2.5]]) {
      expect(() => planContactFrames308(duration!, count!)).toThrow(/VIDEO_CONTACT_/);
    }
  });

  it("refuses missing/out-of-tolerance presentation evidence, rather than guessing timestamp", () => {
    const fake = (actual: number | null, evidence: VideoFrame305Result["timestampEvidence"]): VideoFrame305Result => ({
      blob: new Blob([pngBytes]), width: 1, height: 1, requestedSeconds: 0.4,
      reportedPresentationSeconds: actual, absoluteErrorSeconds: actual === null ? null : Math.abs(actual - 0.4),
      timestampEvidence: evidence,
    });
    expect(verifyPresentedFrame308(fake(0.38, "presented-frame-callback"))).toBe(0.38);
    expect(() => verifyPresentedFrame308(fake(null, "unavailable-in-browser"))).toThrow(/TIMESTAMP_UNVERIFIED/);
    expect(() => verifyPresentedFrame308(fake(0.2, "presented-frame-callback"))).toThrow(/TIMESTAMP_UNVERIFIED/);
    expect(() => verifyPresentedFrame308(fake(0.4, "unavailable-in-browser"))).toThrow(/TIMESTAMP_UNVERIFIED/);
  });

  it("packages actual frame blobs with matching manifest hashes, order and a re-openable STORE-only ZIP", async () => {
    const bytes = readFileSync("quality/fixtures/video-inspection/video-plus-audio.mp4");
    const source = new File([Uint8Array.from(bytes)], "local-clip.mp4", { type: "video/mp4" });
    const inspection = await inspectMp4Local(source);
    const image = new Blob([pngBytes], { type: "image/png" });
    const frames: ContactFrame308[] = [0.4, 0.8].map((sec, index) => ({
      filename: `frame-0${index + 1}.png`, requestedSeconds: sec, presentedSeconds: sec,
      presentationErrorSeconds: 0, sha256: sha(pngBytes), width: 1, height: 1, blob: image,
    }));
    const result = await packageContactSheet308({ source, inspection, frames, sheet: image, sourceSha256: sha(bytes) });
    expect(result.zipEntries).toEqual(["contact-sheet.png", "frame-01.png", "frame-02.png", "manifest.json"]);
    const archive = unzipSync(new Uint8Array(await result.zip.arrayBuffer()));
    expect(Object.keys(archive)).toEqual(result.zipEntries);
    const decoded = JSON.parse(new TextDecoder().decode(archive["manifest.json"]));
    expect(decoded.source.sha256).toBe(sha(bytes));
    expect(decoded.source.declaredVideoTracks).toBeGreaterThanOrEqual(1);
    expect(decoded.generatedInterpretation).toBeNull();
    expect(decoded.frames.map((frame: {presentedSeconds: number}) => frame.presentedSeconds)).toEqual([0.4, 0.8]);
    for (const frame of frames) expect(sha(archive[frame.filename]!)).toBe(frame.sha256);
    await expect(packageContactSheet308({ source, inspection, frames: [frames[0]!], sheet: image, sourceSha256: sha(bytes) })).rejects.toThrow(/VIDEO_CONTACT_PACKAGE/);
  });
});
