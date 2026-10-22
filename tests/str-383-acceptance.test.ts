import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adjustSrgbPixels383, inspectEditorSource383 } from "../src/engines/image/color-adjustment-383";
import { computeResizePlan } from "../src/engines/image/policy";

describe("STR-383 curves, levels and resize", () => {
  it("applies explicit levels in encoded sRGB without changing the source", () => {
    const data = new Uint8ClampedArray([64, 128, 192, 255]);
    const result = adjustSrgbPixels383(
      { width: 1, height: 1, data, colorSpace: "srgb" },
      { levels: { black: 64, white: 192, gamma: 1 } },
    );
    expect([...result.data]).toEqual([0, 128, 255, 255]);
    expect([...data]).toEqual([64, 128, 192, 255]);
    expect(result.colorSpace).toBe("srgb");
  });

  it("interpolates tone curves with independent expected samples and retains alpha", () => {
    const pixels = new Uint8ClampedArray([0, 64, 128, 255, 255, 128, 0, 64]);
    const adjusted = adjustSrgbPixels383(
      { width: 2, height: 1, colorSpace: "srgb", data: pixels },
      { curve: [{ input: 0, output: 0 }, { input: 128, output: 64 }, { input: 255, output: 255 }] },
    );
    expect([...adjusted.data]).toEqual([0, 32, 64, 255, 255, 64, 0, 64]);
    expect([...pixels]).toEqual([0, 64, 128, 255, 255, 128, 0, 64]);
  });

  it("shares the existing resize geometry instead of introducing a second resampler", () => {
    expect(computeResizePlan(800, 400, 200, 200, "contain")).toMatchObject({
      outputWidth: 200, outputHeight: 100, sourceWidth: 800, sourceHeight: 400,
    });
  });

  it("declares untagged input as assumed sRGB, without a false embedded ICC claim", async () => {
    const file = new Blob([await readFile(new URL("../quality/fixtures/image-metadata/synthetic-1x1-rgb.png", import.meta.url))], { type: "image/png" });
    expect(await inspectEditorSource383(file)).toMatchObject({
      sourceProfile: "untagged-assumed-srgb",
      workingColorSpace: "srgb",
      outputProfile: "srgb-canvas",
    });
  });
});
