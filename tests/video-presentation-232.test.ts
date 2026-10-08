import { describe, expect, it } from "vitest";
import type { Mp4Inspection, Mp4TrackInspection } from "../src/engines/video/mp4-inspection";
import {
  UNKNOWN_VIDEO_VALUE, formatContainerRate, formatFrameRate, formatPlanRate,
  formatTrackResolution, formatVideoDuration, formatVideoRotation, planDescription,
} from "../src/components/tools/video/video-presentation";
import { planVideoTargetSize } from "../src/engines/video/target-size";

const unknownTrack: Mp4TrackInspection = {
  id: 1, kind: "video", codecFourCc: null, width: null, height: null,
  matrix: null, quarterTurnDegrees: null,
  frameRate: null, frameRateMode: "unknown", decodeTiming: "not-proven",
};

describe("232 — video output labels stay truthful", () => {
  it("never synthesizes fps, resolution, rotation or duration from missing MP4 atoms", () => {
    expect(formatFrameRate(unknownTrack)).toBe(UNKNOWN_VIDEO_VALUE);
    expect(formatVideoRotation(unknownTrack.quarterTurnDegrees)).toBe(UNKNOWN_VIDEO_VALUE);
    expect(formatTrackResolution(unknownTrack)).toBe(UNKNOWN_VIDEO_VALUE);
    expect(formatVideoDuration(null)).toBe(UNKNOWN_VIDEO_VALUE);
    const info: Mp4Inspection = {
      container: "iso-bmff-mp4", majorBrand: "isom", bytes: 100,
      durationSeconds: null, averageContainerBitrateBps: null,
      totalTracks: 1, videoTracks: 1, audioTracks: 0,
      containsMovieFragments: true, tracks: [unknownTrack], warnings: [],
    };
    expect(formatContainerRate(info)).toBe(UNKNOWN_VIDEO_VALUE);
  });

  it("labels container throughput separately and respects explicit rotation", () => {
    expect(formatVideoRotation(0)).toContain("0°");
    expect(formatVideoRotation(270)).toContain("270°");
    expect(formatContainerRate({
      container: "iso-bmff-mp4", majorBrand: "isom", bytes: 1_000_000,
      durationSeconds: 2, averageContainerBitrateBps: 4_000_000,
      totalTracks: 1, videoTracks: 1, audioTracks: 0,
      containsMovieFragments: false, tracks: [unknownTrack], warnings: [],
    })).toContain("intero file");
  });

  it("keeps video share and encoder feasibility unknown with unprovided audio rate", () => {
    const plan = planVideoTargetSize({ durationSeconds: 100, targetSize: 10, unit: "MB" });
    expect(formatPlanRate(plan.totalStreamBitrateBps)).toContain("800");
    expect(formatPlanRate(plan.videoBitrateBps)).toBe(UNKNOWN_VIDEO_VALUE);
    expect(planDescription(plan)).toContain("sconosciuto");
  });
});
