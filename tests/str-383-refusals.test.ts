import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adjustSrgbPixels383, inspectEditorSource383 } from "../src/engines/image/color-adjustment-383";

const fixture = async (path: string) => new Blob([await readFile(new URL(path, import.meta.url))]);

describe("STR-383 ICC/EXIF refusals", () => {
  it("refuses embedded ICC rather than converting a tagged JPEG silently", async () => {
    await expect(inspectEditorSource383(await fixture("./fixtures/image-exifr-272/jpeg-icc-iptc.jpg")))
      .rejects.toThrow(/UNVERIFIED_COLOR_PROFILE/u);
  });

  it("refuses EXIF in PNG instead of silently changing pixel orientation", async () => {
    await expect(inspectEditorSource383(await fixture("../quality/fixtures/image-metadata-segments/with-exif.png")))
      .rejects.toThrow(/UNVERIFIED_COLOR_PROFILE/u);
  });

  it("refuses truncated and unknown containers (no sRGB inference)", async () => {
    await expect(inspectEditorSource383(await fixture("../quality/fixtures/image-metadata/corrupt-truncated.png")))
      .rejects.toThrow(/UNVERIFIED_COLOR_PROFILE/u);
    await expect(inspectEditorSource383(new Blob([new Uint8Array([0, 1, 2])])))
      .rejects.toThrow(/UNVERIFIED_COLOR_PROFILE/u);
  });

  it("rejects unlabelled, wide-gamut, invalid levels and oversized data", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255]);
    const source = { width: 1, height: 1, data: rgba };
    expect(() => adjustSrgbPixels383(source, {})).toThrow(/UNVERIFIED_COLOR_PROFILE/u);
    expect(() => adjustSrgbPixels383({ ...source, colorSpace: "display-p3" }, {}))
      .toThrow(/UNVERIFIED_COLOR_PROFILE/u);
    expect(() => adjustSrgbPixels383({ ...source, colorSpace: "srgb" }, { levels: { black: 200, white: 100, gamma: 1 } }))
      .toThrow(/INVALID_INPUT/u);
    expect(() => adjustSrgbPixels383({ ...source, colorSpace: "srgb" }, { curve: [{ input: 4, output: 5 }] }))
      .toThrow(/INVALID_INPUT/u);
    expect(() => adjustSrgbPixels383({ ...source, width: 9000, colorSpace: "srgb" }, {}))
      .toThrow(/INVALID_INPUT/u);
  });

  it("honors cancellation before inspecting bytes or allocating transformed pixels", async () => {
    const controller = new AbortController();
    controller.abort();
    const file = await fixture("../quality/fixtures/image-metadata/synthetic-1x1-rgb.png");
    await expect(inspectEditorSource383(file, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(() => adjustSrgbPixels383({ width: 1, height: 1, data: new Uint8ClampedArray(4), colorSpace: "srgb" }, {}, controller.signal))
      .toThrow(/cancelled/u);
  });
});
