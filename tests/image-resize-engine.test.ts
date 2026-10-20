import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectImageHeader, signatureMatches } from "../src/engines/image/format";
import {
  IMAGE_LIMITS,
  computeResizeDimensions,
  computeResizePlan,
  estimateDecodedBytes,
  lockedHeightForWidth,
  lockedWidthForHeight,
  preflightAllocation,
  safeOutputStem,
  scaleDimensionsByPercent,
} from "../src/engines/image/policy";
import { resizeWithPica271 } from "../src/engines/image/resize-pica-271";
import { resizeImageLocal } from "../src/tools/image-resize/module";

const root = resolve(import.meta.dirname, "..");

describe("image resize policy", () => {
  it("computes contain and cover geometry without exceeding requested output", () => {
    expect(computeResizePlan(1600, 1200, 800, 800, "contain")).toEqual({
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 1600,
      sourceHeight: 1200,
      outputWidth: 800,
      outputHeight: 600,
    });
    expect(computeResizePlan(1600, 1200, 800, 800, "cover")).toEqual({
      sourceX: 200,
      sourceY: 0,
      sourceWidth: 1200,
      sourceHeight: 1200,
      outputWidth: 800,
      outputHeight: 800,
    });
  });

  it("keeps percent, aspect-lock and no-upscale dimensions deterministic", () => {
    expect(scaleDimensionsByPercent(1600, 1200, 50)).toEqual({ width: 800, height: 600 });
    expect(scaleDimensionsByPercent(1600, 1200, 125)).toEqual({ width: 2000, height: 1500 });
    expect(lockedHeightForWidth(1000, 1600, 1200)).toBe(750);
    expect(lockedWidthForHeight(900, 1600, 1200)).toBe(1200);

    expect(computeResizeDimensions(1600, 1200, 2400, 2400, "contain", true)).toEqual({
      outputWidth: 1600,
      outputHeight: 1200,
    });
    expect(computeResizePlan(1600, 1200, 2400, 2400, "cover", true)).toEqual({
      sourceX: 200,
      sourceY: 0,
      sourceWidth: 1200,
      sourceHeight: 1200,
      outputWidth: 1200,
      outputHeight: 1200,
    });
  });

  it("preflights decoded surfaces rather than compressed bytes only", () => {
    const expected = estimateDecodedBytes(4_000_000, 1_000_000);
    expect(preflightAllocation(50_000, 2000, 2000, 1000, 1000)).toEqual({
      sourcePixels: 4_000_000,
      outputPixels: 1_000_000,
      estimatedDecodedBytes: expected,
    });
    expect(() => preflightAllocation(50_000, 4000, 4000, 4000, 4000)).toThrow(
      /MEMORY_LIMIT/u,
    );
  });

  it("rejects oversized dimensions and sanitizes output names", () => {
    expect(() =>
      preflightAllocation(10_000, IMAGE_LIMITS.maxDimension + 1, 1, 1, 1),
    ).toThrow(/IMAGE_TOO_LARGE/u);
    expect(safeOutputStem("../../ launch / hero photo.JPG")).toBe("hero-photo");
  });
});

describe("image signature and header checks", () => {
  it("reads dimensions from the synthetic PNG fixture", async () => {
    const bytes = new Uint8Array(
      await readFile(resolve(root, "quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png")),
    );
    expect(inspectImageHeader(bytes)).toEqual({ mime: "image/png", width: 2, height: 3 });
  });

  it("treats the header parser as preflight evidence, not full decode validation", async () => {
    const corrupt = new Uint8Array(
      await readFile(resolve(root, "quality/fixtures/image-metadata/corrupt-truncated.png")),
    );
    // This 24-byte fixture stops INSIDE IHDR, before its CRC or any IDAT;
    // incomplete pre-IDAT headers cannot prove displayed EXIF geometry.
    expect(() => inspectImageHeader(corrupt)).toThrow(/TRUNCATED_IMAGE/u);
    const valid = new Uint8Array(
      await readFile(resolve(root, "quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png")),
    );
    const idatHeader = Buffer.from(valid).indexOf("IDAT") - 4;
    expect(idatHeader).toBeGreaterThan(33);
    expect(() => inspectImageHeader(valid.subarray(0, idatHeader + 7))).toThrow(/TRUNCATED_IMAGE/u);
    // A complete IDAT chunk header is enough for header-only preflight:
    // its compressed pixels and remaining CRC may still be absent.
    expect(inspectImageHeader(valid.subarray(0, idatHeader + 8)))
      .toEqual({ mime: "image/png", width: 2, height: 3 });
    expect(() => inspectImageHeader(new Uint8Array([1, 2, 3, 4]))).toThrow(/UNSUPPORTED_TYPE/u);
  });

  it("recognizes JPEG and WebP output signatures without trusting labels", () => {
    expect(signatureMatches(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]), "image/jpeg")).toBe(true);
    expect(
      signatureMatches(
        new TextEncoder().encode("RIFFxxxxWEBP"),
        "image/webp",
      ),
    ).toBe(true);
    expect(signatureMatches(new Uint8Array([0xff, 0xd8, 0xff]), "image/webp")).toBe(false);
  });
});

describe("image resize cancellation", () => {
  it("honors an already-aborted signal before touching browser image APIs", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(resizeImageLocal({}, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

describe("Pica #271 memory safety and geometry fallback", () => {
  it("refuses Pica before allocation when its additional working set would exceed 96 MiB", async () => {
    const bitmap = { width: 4000, height: 3000 } as ImageBitmap;
    const plan = computeResizePlan(4000, 3000, 2000, 1500, "contain");
    await expect(resizeWithPica271(bitmap, plan, {} as HTMLCanvasElement, 90 * 1024 * 1024))
      .resolves.toEqual({ engine: "canvas", reason: "MEMORY_BUDGET" });
  });
  it("keeps crop geometry and no-upscale on the existing Canvas path", async () => {
    const bitmap = { width: 600, height: 400 } as ImageBitmap;
    await expect(resizeWithPica271(bitmap, computeResizePlan(600, 400, 150, 150, "cover"), {} as HTMLCanvasElement, 1000))
      .resolves.toEqual({ engine: "canvas", reason: "COVER_CROP" });
    await expect(resizeWithPica271(bitmap, computeResizePlan(600, 400, 1000, 1000, "contain", true), {} as HTMLCanvasElement, 1000))
      .resolves.toEqual({ engine: "canvas", reason: "NOT_DOWNSCALE" });
  });
});
