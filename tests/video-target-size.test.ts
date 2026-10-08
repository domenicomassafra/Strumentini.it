import { describe, expect, it } from "vitest";
import { estimateVideoStreamBytes, planVideoTargetSize } from "../src/engines/video/target-size";

describe("ticket 232 — truthful, decoder-free video target-size planning", () => {
  it("uses decimal MB and exact seconds; unknown audio stays unknown", () => {
    expect(planVideoTargetSize({ durationSeconds: 100, targetSize: 100, unit: "MB" })).toMatchObject({
      targetBytes: 100_000_000,
      totalStreamBitrateBps: 8_000_000,
      videoBitrateBps: null,
      audioBitrateBps: null,
      observedContainerOverhead: false,
      achievesTargetSize: "unknown",
    });
  });

  it("distinguishes binary MiB and reserves explicit audio and overhead", () => {
    const binary = planVideoTargetSize({ durationSeconds: 100, targetSize: 100, unit: "MiB" });
    expect(binary.targetBytes).toBe(104_857_600);
    expect(binary.totalStreamBitrateBps).toBe(8_388_608);
    const reserved = planVideoTargetSize({
      durationSeconds: 100, targetSize: 100, unit: "MB",
      audioBitrateBps: 128_000, reservedOverheadBytes: 1_000_000,
    });
    expect(reserved.totalStreamBitrateBps).toBe(7_920_000);
    expect(reserved.videoBitrateBps).toBe(7_792_000);
  });

  it("never invents an audio track when an explicit no-audio estimate is requested", () => {
    const result = planVideoTargetSize({ durationSeconds: 100, targetSize: 100, unit: "MB", audioBitrateBps: 0 });
    expect(result.audioBitrateBps).toBe(0);
    expect(result.videoBitrateBps).toBe(8_000_000);
  });

  it("calculates a theoretical payload estimate, not container or encoder fidelity", () => {
    expect(estimateVideoStreamBytes(8_000_000, 100)).toBe(100_000_000);
    expect(estimateVideoStreamBytes(128_000, 0.5)).toBe(8_000);
  });

  it.each([
    { durationSeconds: 0, targetSize: 100, unit: "MB" },
    { durationSeconds: -1, targetSize: 100, unit: "MB" },
    { durationSeconds: Number.POSITIVE_INFINITY, targetSize: 100, unit: "MB" },
    { durationSeconds: 100, targetSize: 0, unit: "MB" },
    { durationSeconds: 100, targetSize: Number.NaN, unit: "MB" },
    { durationSeconds: 100, targetSize: 100, unit: "GB" },
    { durationSeconds: 100, targetSize: 2_000_000_000, unit: "MB" },
    { durationSeconds: 100, targetSize: 100, unit: "MB", audioBitrateBps: -1 },
    { durationSeconds: 100, targetSize: 100, unit: "MB", audioBitrateBps: 8_000_000 },
    { durationSeconds: 100, targetSize: 100, unit: "MB", reservedOverheadBytes: 100_000_000 },
    { durationSeconds: 100, targetSize: 100, unit: "MB", reservedOverheadBytes: -1 },
  ])("refuses invalid budget %j", (input) => {
    expect(() => planVideoTargetSize(input as Parameters<typeof planVideoTargetSize>[0])).toThrow(RangeError);
  });

  it.each([
    [-1, 100], [Number.NaN, 100], [1000.5, 100], [8000, 0], [8000, Number.POSITIVE_INFINITY],
  ])("refuses unsupported stream bytes estimate %j", (bitrate, duration) => {
    expect(() => estimateVideoStreamBytes(bitrate, duration)).toThrow(RangeError);
  });
});
