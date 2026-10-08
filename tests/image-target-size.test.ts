import { describe, expect, it } from "vitest";
import { findImageTargetSize, parseImageTarget } from "../src/engines/image/target-size";

const blobOf = (bytes: number, mime: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg") =>
  new Blob([new Uint8Array(bytes)], { type: mime });

describe("ticket 210 — image target size solver", () => {
  it("validates bounded targets without rounding success up", () => {
    expect(parseImageTarget(1)).toBe(1024);
    expect(parseImageTarget(1.1)).toBe(1126);
    for (const invalid of [NaN, Infinity, 0, -1, 40961, "100", null]) {
      expect(() => parseImageTarget(invalid), String(invalid)).toThrow();
    }
  });

  it("asserts success only from measured Blob bytes, including a nonmonotonic encoder", async () => {
    const observed: Array<[number, number]> = [];
    const result = await findImageTargetSize(
      { mime: "image/jpeg", targetKiB: 2, minQuality: 0.4 },
      async (scale, quality) => {
        observed.push([scale, quality]);
        return blobOf(quality === 0.72 ? 2100 : quality === 0.62 ? 1900 : 2500);
      },
    );
    expect(result.meetsTarget).toBe(true);
    expect(result.quality).toBe(0.62);
    expect(result.blob.size).toBeLessThanOrEqual(result.targetBytes);
    expect(result.attempts).toBe(4);
    expect(observed.every(([scale]) => scale === 1)).toBe(true);
  });

  it("returns the smallest truthful best effort if the target cannot be reached", async () => {
    const result = await findImageTargetSize(
      { mime: "image/jpeg", targetKiB: 1, minQuality: 0.52 },
      async (_scale, quality) => blobOf(quality === 0.72 ? 1500 : 2800),
    );
    expect(result.meetsTarget).toBe(false);
    expect(result.blob.size).toBe(1500);
    expect(result.reason).toBe("quality-floor");
    expect(result.attempts).toBe(5);
  });

  it("never downscales without separate explicit permission", async () => {
    const scales: number[] = [];
    const encode = async (scale: number) => { scales.push(scale); return blobOf(scale === 0.7 ? 700 : 3000); };
    const none = await findImageTargetSize({ mime: "image/jpeg", targetKiB: 1 }, encode);
    expect(none.meetsTarget).toBe(false);
    expect(scales).toEqual([1, 1, 1, 1, 1, 1]);
    scales.length = 0;
    const allowed = await findImageTargetSize({ mime: "image/jpeg", targetKiB: 1, allowResize: true }, encode);
    expect(allowed.meetsTarget).toBe(true);
    expect(allowed.scale).toBe(0.7);
  });

  it("does not pretend PNG quality is adjustable", async () => {
    let attempts = 0;
    const result = await findImageTargetSize({ mime: "image/png", targetKiB: 1 }, async () => {
      attempts++;
      return blobOf(1300, "image/png");
    });
    expect(attempts).toBe(1);
    expect(result.meetsTarget).toBe(false);
    expect(result.reason).toBe("png-no-quality-control");
  });

  it("rejects fallback MIME and enforces cancellation between trials", async () => {
    await expect(findImageTargetSize({ mime: "image/webp", targetKiB: 1 },
      async () => blobOf(2000, "image/png"))).rejects.toThrow("OUTPUT_VALIDATION_FAILED");
    const abort = new AbortController();
    let attempts = 0;
    await expect(findImageTargetSize({ mime: "image/jpeg", targetKiB: 1 }, async () => {
      attempts++;
      abort.abort();
      return blobOf(5000);
    }, abort.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(attempts).toBe(1);
  });
});
