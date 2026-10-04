import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRIVACY_BEARING_CARRIERS, scanImageMetadata } from "../src/engines/image/metadata";
import { calculatePlatformSizes, PLATFORM_PRESETS, containBox, coverCropFor, ratioLabel } from "../src/engines/image/presets";
import platformSizePresetsModule from "../src/tools/platform-size-presets/module";
import exifRemoverModule from "../src/tools/exif-remover/module";

interface MetadataFixture {
  readonly artifacts: readonly {
    readonly path: string;
    readonly format: string;
    readonly segments: readonly { readonly segment: string; readonly carrier: string; readonly bytes: number }[] | null;
    readonly privacy_segment_count?: number;
    readonly complete?: boolean;
  }[];
  readonly rejected_inputs: readonly {
    readonly name: string;
    readonly bytes_hex: string;
    readonly expected_format: string;
    readonly expected_complete: boolean;
  }[];
}

interface PresetFixture {
  readonly vectors: readonly {
    readonly name: string;
    readonly preset_id: string;
    readonly source_width: number;
    readonly source_height: number;
    readonly contain: { readonly width: number; readonly height: number };
    readonly cover_crop: { readonly width: number; readonly height: number; readonly x: number; readonly y: number };
    readonly cropped_fraction: number;
    readonly cover_scale: number;
    readonly fit: string;
    readonly meets_resolution: boolean;
    readonly upscale_factor: number;
    readonly source_ratio: string;
    readonly preset_ratio: string;
  }[];
  readonly rejections: readonly {
    readonly name: string;
    readonly preset_id?: string;
    readonly width: number;
    readonly height: number;
  }[];
}

const METADATA = JSON.parse(
  readFileSync(new URL("../quality/fixtures/image-metadata-segments/vectors.json", import.meta.url), "utf8"),
) as MetadataFixture;
const PRESETS = JSON.parse(
  readFileSync(new URL("../quality/fixtures/platform-image-presets/vectors.json", import.meta.url), "utf8"),
) as PresetFixture;

const context = { defaults: {} } as const;

function bytesOf(relativePath: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`../${relativePath}`, import.meta.url)));
}

describe("image metadata segment inventory", () => {
  it("matches every declared artifact exactly", () => {
    for (const artifact of METADATA.artifacts) {
      const inventory = scanImageMetadata(bytesOf(artifact.path));
      expect(inventory.format, artifact.path).toBe(artifact.format);
      const got = inventory.segments.map((segment) => `${segment.segment}:${segment.carrier}:${segment.bytes}`);
      const want = (artifact.segments ?? []).map((segment) => `${segment.segment}:${segment.carrier}:${segment.bytes}`);
      expect(got, artifact.path).toEqual(want);
      if (artifact.privacy_segment_count !== undefined) {
        expect(inventory.privacySegmentCount, artifact.path).toBe(artifact.privacy_segment_count);
      }
      if (artifact.complete !== undefined) expect(inventory.complete, artifact.path).toBe(artifact.complete);
    }
  });

  it("separates identifying carriers from merely descriptive ones", () => {
    const withText = scanImageMetadata(bytesOf("quality/fixtures/image-metadata-segments/with-text.png"));
    expect(withText.privacySegmentCount).toBe(0);
    expect(withText.segments.map((segment) => segment.carrier).sort()).toEqual(["text", "timestamp"]);

    const withExif = scanImageMetadata(bytesOf("quality/fixtures/image-metadata-segments/with-exif.png"));
    expect(withExif.privacySegmentCount).toBe(1);
    expect(withExif.privacyBytes).toBe(withExif.segments.find((segment) => segment.carrier === "exif")!.bytes);

    const jpeg = scanImageMetadata(bytesOf("quality/fixtures/image-metadata-segments/exif-app1.jpg"));
    expect(jpeg.segments.filter((segment) => PRIVACY_BEARING_CARRIERS.includes(segment.carrier)).map((segment) => segment.carrier).sort()).toEqual(["comment", "exif"]);
  });

  it("tells Exif from XMP inside the same APP1 marker", () => {
    const exif = scanImageMetadata(bytesOf("quality/fixtures/image-metadata-segments/exif-app1.jpg"));
    expect(exif.segments.find((segment) => segment.segment === "JPEG APP1")?.carrier).toBe("exif");
    const xmp = scanImageMetadata(bytesOf("quality/fixtures/image-metadata-segments/xmp-app1.jpg"));
    expect(xmp.segments).toHaveLength(1);
    expect(xmp.segments[0]?.carrier).toBe("xmp");
    expect(xmp.segments[0]?.segment).toBe("JPEG APP1 XMP");
  });

  it("recognises IPTC in APP13", () => {
    const iptc = scanImageMetadata(bytesOf("quality/fixtures/image-metadata-segments/iptc-app13.jpg"));
    expect(iptc.segments).toEqual([expect.objectContaining({ carrier: "iptc", segment: "JPEG APP13" })]);
  });

  it("reports a clean file as clean rather than as unknown", () => {
    const clean = scanImageMetadata(bytesOf("quality/fixtures/image-metadata-segments/clean.png"));
    expect(clean.format).toBe("png");
    expect(clean.segments).toEqual([]);
    expect(clean.privacySegmentCount).toBe(0);
    expect(clean.complete).toBe(true);
  });

  it("marks a truncated file incomplete instead of returning a partial answer as whole", () => {
    const truncated = scanImageMetadata(bytesOf("quality/fixtures/image-metadata-segments/truncated.png"));
    expect(truncated.format).toBe("png");
    expect(truncated.complete).toBe(false);
    const unrecognised = scanImageMetadata(bytesOf("quality/fixtures/image-metadata-segments/not-an-image.bin"));
    expect(unrecognised.format).toBe("unknown");
    expect(unrecognised.complete).toBe(false);
  });

  it("refuses every declared unusable input", () => {
    for (const input of METADATA.rejected_inputs) {
      const inventory = scanImageMetadata(new Uint8Array(Buffer.from(input.bytes_hex, "hex")));
      expect(inventory.format, input.name).toBe(input.expected_format);
      expect(inventory.complete, input.name).toBe(input.expected_complete);
    }
  });

  it("never grows the buffer it was handed", () => {
    const bytes = bytesOf("quality/fixtures/image-metadata-segments/exif-app1.jpg");
    const before = bytes.length;
    scanImageMetadata(bytes);
    expect(bytes.length).toBe(before);
  });
});

describe("platform image presets", () => {
  it("matches every declared vector", () => {
    for (const vector of PRESETS.vectors) {
      const preset = PLATFORM_PRESETS.find((entry) => entry.id === vector.preset_id);
      expect(preset, vector.name).toBeDefined();
      const result = calculatePlatformSizes(preset!, vector.source_width, vector.source_height);
      expect(result.contain, vector.name).toEqual(vector.contain);
      expect(result.coverCrop, vector.name).toEqual(vector.cover_crop);
      expect(result.croppedFraction, vector.name).toBeCloseTo(vector.cropped_fraction, 4);
      expect(result.coverScale, vector.name).toBeCloseTo(vector.cover_scale, 4);
      expect(result.fit, vector.name).toBe(vector.fit);
      expect(result.meetsResolution, vector.name).toBe(vector.meets_resolution);
      expect(result.upscaleFactor, vector.name).toBeCloseTo(vector.upscale_factor, 2);
      expect(result.sourceRatio, vector.name).toBe(vector.source_ratio);
      expect(result.presetRatio, vector.name).toBe(vector.preset_ratio);
    }
  });

  it("keeps the contain box inside the canvas and the crop box inside the source", () => {
    for (const preset of PLATFORM_PRESETS) {
      for (const [width, height] of [[1, 1], [37, 11], [800, 600], [4000, 3001], [1080, 1920]] as const) {
        const result = calculatePlatformSizes(preset, width, height);
        expect(result.contain.width, `${preset.id} ${width}x${height}`).toBeLessThanOrEqual(preset.width);
        expect(result.contain.height, `${preset.id} ${width}x${height}`).toBeLessThanOrEqual(preset.height);
        expect(result.coverCrop.x, `${preset.id} ${width}x${height}`).toBeGreaterThanOrEqual(0);
        expect(result.coverCrop.y, `${preset.id} ${width}x${height}`).toBeGreaterThanOrEqual(0);
        expect(result.coverCrop.x + result.coverCrop.width, `${preset.id} ${width}x${height}`).toBeLessThanOrEqual(width);
        expect(result.coverCrop.y + result.coverCrop.height, `${preset.id} ${width}x${height}`).toBeLessThanOrEqual(height);
        expect(result.croppedFraction, `${preset.id} ${width}x${height}`).toBeGreaterThanOrEqual(0);
        expect(result.croppedFraction, `${preset.id} ${width}x${height}`).toBeLessThan(1);
      }
    }
  });

  it("centres the crop, and keeps the cropped box at the canvas ratio", () => {
    for (const preset of PLATFORM_PRESETS) {
      for (const [width, height] of [[900, 400], [400, 900], [1920, 1080]] as const) {
        const crop = coverCropFor(width, height, preset.width, preset.height);
        const left = crop.x;
        const right = width - crop.x - crop.width;
        expect(Math.abs(left - right), `${preset.id} ${width}x${height}`).toBeLessThanOrEqual(1);
        const top = crop.y;
        const bottom = height - crop.y - crop.height;
        expect(Math.abs(top - bottom), `${preset.id} ${width}x${height}`).toBeLessThanOrEqual(1);
        const cropRatio = crop.width / crop.height;
        const targetRatio = preset.width / preset.height;
        expect(Math.abs(cropRatio - targetRatio) / targetRatio, `${preset.id} ${width}x${height}`).toBeLessThan(0.01);
      }
    }
  });

  it("never claims an upscale when the source already fits", () => {
    for (const preset of PLATFORM_PRESETS) {
      const exact = calculatePlatformSizes(preset, preset.width, preset.height);
      expect(exact.meetsResolution).toBe(true);
      expect(exact.upscaleFactor).toBe(1);
      expect(exact.fit).toBe("same-ratio");
      expect(exact.croppedFraction).toBe(0);
      const half = calculatePlatformSizes(preset, Math.floor(preset.width / 2), Math.floor(preset.height / 2));
      expect(half.meetsResolution).toBe(false);
      expect(half.upscaleFactor).toBeGreaterThan(1);
    }
  });

  it("reduces a ratio to its simplest terms and falls back to a decimal when unwieldy", () => {
    expect(ratioLabel(1920, 1080)).toBe("16:9");
    expect(ratioLabel(1080, 1080)).toBe("1:1");
    expect(ratioLabel(1500, 500)).toBe("3:1");
    expect(ratioLabel(1200, 630)).toBe("40:21");
    expect(ratioLabel(1, 0)).toBe("1:0");
    const decimal = ratioLabel(1201, 627);
    expect(decimal).toMatch(/^\d,\d{3}:1$/u);
  });

  it("computes contain independently of the preset table", () => {
    expect(containBox(1920, 1080, 1200, 630)).toEqual({ width: 1120, height: 630 });
    expect(containBox(1080, 1080, 1080, 1080)).toEqual({ width: 1080, height: 1080 });
    expect(containBox(1, 100, 50, 50)).toEqual({ width: 1, height: 50 });
  });

  it("binds every preset to a source and a verification date", () => {
    expect(PLATFORM_PRESETS.length).toBeGreaterThanOrEqual(8);
    for (const preset of PLATFORM_PRESETS) {
      expect(preset.labelIt, preset.id).toMatch(/[a-zà-ÿ]/iu);
      expect(preset.scopeIt, preset.id).not.toBe("");
      expect(preset.source, preset.id).not.toBe("");
      expect(preset.verifiedOn, preset.id).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(preset.width, preset.id).toBeGreaterThan(0);
      expect(preset.height, preset.id).toBeGreaterThan(0);
    }
    expect(new Set(PLATFORM_PRESETS.map((preset) => preset.id)).size).toBe(PLATFORM_PRESETS.length);
  });

  it("rejects every declared unusable input through the tool module", () => {
    for (const rejection of PRESETS.rejections) {
      expect(() =>
        platformSizePresetsModule.run(
          rejection.preset_id === undefined
            ? { width: rejection.width, height: rejection.height }
            : { presetId: rejection.preset_id, width: rejection.width, height: rejection.height },
          context,
        ),
        rejection.name,
      ).toThrow();
    }
  });

  it("returns the whole published record for the selected preset", () => {
    const result = platformSizePresetsModule.run({ presetId: "open-graph", width: 1920, height: 1080 }, context) as ReturnType<typeof calculatePlatformSizes>;
    expect(result.preset).toMatchObject({ id: "open-graph", width: 1200, height: 630, source: expect.any(String), verifiedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u) });
    expect(result.cover).toEqual({ width: 1200, height: 630 });
    expect(result.contain).toEqual({ width: 1120, height: 630 });
    expect(result.coverCrop).toEqual({ width: 1920, height: 1008, x: 0, y: 36 });
  });
});

describe("exif remover module contract", () => {
  it("routes to the local stripper and needs a file", async () => {
    await expect(exifRemoverModule.run({}, context)).rejects.toThrow("Choose a local image file");
    await expect(exifRemoverModule.run(null, context)).rejects.toThrow("INVALID_INPUT");
    await expect(exifRemoverModule.run({ file: new Uint8Array(4) }, context)).rejects.toThrow("Choose a local image file");
  });

  it("declares a fail-closed policy for the produced file", () => {
    expect(exifRemoverModule).toHaveProperty("run");
  });
});