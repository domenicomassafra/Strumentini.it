import { describe, expect, it } from "vitest";
import { imageResizeManifest } from "../src/tools/image-resize/manifest";
import { imageVisualToolDefinitions } from "../src/tools/image-visual-definitions";
import { aspectRatio, contrastRatio, extractPalette, fitDimensions, parseHexColor, rgbToHsl } from "../src/engines/image/visual";
import { calculateAspectRatioLocal, checkContrastLocal, convertColorLocal, previewImageRenamesLocal } from "../src/engines/image/visual-tools";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function fakeFile(name: string, bytes = new Uint8Array([1, 2, 3])): File {
  return new File([bytes], name, { type: "image/png" });
}

describe("image/visual expansion manifests", () => {
  it("covers the complete 20-tool image tranche with stable IDs and local runtime", () => {
    expect(imageVisualToolDefinitions).toHaveLength(19);
    expect(imageVisualToolDefinitions.length + 1).toBe(20);
    expect(imageVisualToolDefinitions.map(([id]) => id)).toContain("image-crop");
    expect(imageVisualToolDefinitions.map(([id]) => id)).toContain("perceptual-duplicate-finder");
    expect(imageResizeManifest.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
    for (const [, , , , , , , oracleEntryId] of imageVisualToolDefinitions) {
      expect(oracleEntryId).toMatch(/^cand-\d{3}$/u);
    }
  });
});

describe("image/visual pure operations", () => {
  it("converts colors and reports WCAG contrast thresholds", () => {
    expect(convertColorLocal({ hex: "#336699" })).toMatchObject({ hex: "#336699", rgb: { r: 51, g: 102, b: 153 } });
    expect(checkContrastLocal({ foreground: "#000000", background: "#ffffff" })).toMatchObject({ aaNormal: true, aaLarge: true, aaaNormal: true });
    expect(checkContrastLocal({ foreground: "#777777", background: "#ffffff" }).aaNormal).toBe(false);
  });

  it("reduces aspect ratios and calculates bounded fit dimensions", () => {
    expect(aspectRatio(1600, 1200)).toBe("4:3 (1.3333)");
    expect(calculateAspectRatioLocal({ width: 1600, height: 1200 })).toMatchObject({ ratio: "4:3 (1.3333)", contain: { width: 1440, height: 1080 } });
    expect(fitDimensions(4000, 3000, 800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("extracts deterministic quantized palette values from bounded pixel data", () => {
    const image = { width: 4, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255]), colorSpace: "srgb" } as ImageData;
    expect(extractPalette(image, 3)).toEqual([
      { hex: "#ff0000", pixels: 3 },
      { hex: "#0000ff", pixels: 1 },
    ]);
  });

  it("previews safe batch names without mutating the input", () => {
    const files = [fakeFile("../hero photo.png"), fakeFile("launch card.png")];
    const result = previewImageRenamesLocal({ files, prefix: "asset-", start: 7 });
    expect(result.items.map((item) => item.renamed)).toEqual(["asset-07-hero-photo.png", "asset-08-launch-card.png"]);
    expect(files.map((file) => file.name)).toEqual(["../hero photo.png", "launch card.png"]);
  });

  it("keeps the existing image fixture independently inspectable", async () => {
    const bytes = new Uint8Array(await readFile(resolve(root, "quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png")));
    expect(bytes.slice(0, 8)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
  });
});
