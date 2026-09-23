import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectImageHeader, signatureMatches } from "../src/engines/image/format";
import {
  IMAGE_LIMITS,
  computeResizePlan,
  estimateDecodedBytes,
  preflightAllocation,
  safeOutputStem,
} from "../src/engines/image/policy";
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
    expect(inspectImageHeader(corrupt)).toMatchObject({ mime: "image/png" });
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
