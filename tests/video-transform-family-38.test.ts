import { describe, expect, it } from "vitest";
import { measureCompression38, planCompression38 } from "../src/engines/video/compression-strategy-38";

describe("#38 compression strategy and measured receipts", () => {
  it("distinguishes an actual bitrate request from an unguaranteed target-size estimate", () => {
    const bitrate = planCompression38({ mode: "bitrate", videoBitrateKbps: 350 }, 1.5);
    expect(bitrate).toMatchObject({
      strategy: "bitrate", requestedVideoBitrateBps: 350_000, requestedSizeBytes: null,
      targetGuarantee: false, audioBitrateBps: 96_000, overheadReserveBytes: 4096,
    });
    const sizing = planCompression38({ mode: "target-size", targetMegabytes: 0.08 }, 1.5);
    expect(sizing.requestedSizeBytes).toBe(80_000);
    expect(sizing.requestedVideoBitrateBps).toBeGreaterThan(180_000);
    expect(sizing.requestedVideoBitrateBps).toBeLessThan(350_000);
    expect(sizing.targetGuarantee).toBe(false);
    expect(measureCompression38(sizing, 27463, 8824, 1.578667)).toMatchObject({
      sourceBytes: 27463, outputBytes: 8824, savedBytes: 18639,
      strategy: "target-size", requestedSizeBytes: 80_000, targetAchieved: true,
    });
    expect(measureCompression38(sizing, 30000, 81000, 1.5).targetAchieved).toBe(false);
    expect(measureCompression38(bitrate, 2000, 3000, 1).savedBytes).toBe(-1000);
    expect(measureCompression38(bitrate, 2000, 3000, 1).savedPercent).toBe(-50);
  });

  it("rejects budget and bitrate requests outside actual encoder capability", () => {
    expect(() => planCompression38({ mode: "bitrate", videoBitrateKbps: 0 }, 2)).toThrow("TARGET_UNSUPPORTED");
    expect(() => planCompression38({ mode: "bitrate", videoBitrateKbps: 3_100 }, 2)).toThrow("TARGET_UNSUPPORTED");
    expect(() => planCompression38({ mode: "target-size", targetMegabytes: 0.001 }, 1)).toThrow("TARGET_SIZE");
    expect(() => planCompression38({ mode: "target-size", targetMegabytes: 8.01 }, 1)).toThrow("TARGET_SIZE");
    expect(() => planCompression38({ mode: "target-size", targetMegabytes: 0.01 }, 12)).toThrow("TARGET_SIZE");
    expect(() => planCompression38({ mode: "target-size", targetMegabytes: 1.5 }, 0.2)).toThrow("DURATION");
    expect(() => measureCompression38(planCompression38({ mode: "bitrate", videoBitrateKbps: 350 }, 1), 1, 0, 1)).toThrow("MEASURE");
  });
});
