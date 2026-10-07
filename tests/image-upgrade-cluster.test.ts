import { describe, expect, it } from "vitest";
import { createZip, inspectZip } from "../src/engines/file-privacy";
import { diffImageMetadata, groupImageMetadata, type MetadataInventory } from "../src/engines/image/metadata";
import { compareRgbaBounded, normalizeIconSizes } from "../src/engines/image/visual-tools";
import contactSheetManifest from "../src/tools/contact-sheet-generator/manifest";
import exifManifest from "../src/tools/exif-remover/manifest";
import faviconManifest from "../src/tools/favicon-app-icon-size-generator/manifest";
import compareManifest from "../src/tools/image-compare-slider/manifest";
import conversionManifest from "../src/tools/image-format-conversion/manifest";
import platformManifest from "../src/tools/platform-size-presets/manifest";

function rgba(width: number, height: number, pixels: readonly number[]) {
  return { width, height, data: new Uint8ClampedArray(pixels) };
}

describe("image upgrade cluster canonical contracts", () => {
  it("keeps the existing canonical routes and oracle bindings", () => {
    expect(conversionManifest).toMatchObject({ id: "image-format-conversion", gold: { oracleEntryId: "cand-143" } });
    expect(platformManifest).toMatchObject({ id: "platform-size-presets", gold: { oracleEntryId: "cand-146" } });
    expect(exifManifest).toMatchObject({ id: "exif-remover", gold: { oracleEntryId: "cand-148" } });
    expect(contactSheetManifest).toMatchObject({ id: "contact-sheet-generator", gold: { oracleEntryId: "cand-156" } });
    expect(faviconManifest).toMatchObject({ id: "favicon-app-icon-size-generator", gold: { oracleEntryId: "cand-157" } });
    expect(compareManifest).toMatchObject({ id: "image-compare-slider", gold: { oracleEntryId: "cand-159" } });
  });

  it("groups metadata before/after into privacy, descriptive and color classes", () => {
    const before: MetadataInventory = {
      format: "png",
      complete: true,
      bytesTotal: 99,
      privacySegmentCount: 1,
      privacyBytes: 49,
      segments: [
        { carrier: "exif", segment: "PNG eXIf", labelIt: "Exif", bytes: 49 },
        { carrier: "text", segment: "PNG tEXt", labelIt: "testo", bytes: 30 },
        { carrier: "icc-profile", segment: "PNG iCCP", labelIt: "ICC", bytes: 20 },
      ],
    };
    const after: MetadataInventory = { format: "png", complete: true, bytesTotal: 0, privacySegmentCount: 0, privacyBytes: 0, segments: [] };
    expect(groupImageMetadata(before).map(({ carrier, class: groupClass }) => [carrier, groupClass])).toEqual([
      ["exif", "privacy"],
      ["icc-profile", "color"],
      ["text", "descriptive"],
    ]);
    const diff = diffImageMetadata(before, after);
    expect(diff.before).toHaveLength(3);
    expect(diff.after).toEqual([]);
    expect(diff.removed.map((entry) => entry.carrier)).toEqual(["exif", "icc-profile", "text"]);
    expect(diff.retained).toEqual([]);
  });

  it("applies bounded RGBA pixel diff with an explicit threshold", () => {
    const first = rgba(2, 1, [10, 20, 30, 255, 100, 100, 100, 255]);
    const second = rgba(2, 1, [10, 20, 30, 255, 105, 100, 100, 255]);
    const strict = compareRgbaBounded(first, second, 0);
    expect(strict).toMatchObject({ sampledPixels: 2, differentPixels: 1, differenceRatio: 0.5 });
    expect(strict.meanAbsoluteChannelDifference).toBeCloseTo(0.625, 6);
    const tolerant = compareRgbaBounded(first, second, 5);
    expect(tolerant.differentPixels).toBe(0);
    expect(() => compareRgbaBounded(first, second, 256)).toThrow(/threshold/u);
  });

  it("uses each source row stride correctly for unequal dimensions and honors the sample bound", () => {
    const first = rgba(2, 2, [
      0, 0, 0, 255, 10, 0, 0, 255,
      20, 0, 0, 255, 30, 0, 0, 255,
    ]);
    const second = rgba(3, 2, [
      0, 0, 0, 255, 10, 0, 0, 255, 99, 0, 0, 255,
      20, 0, 0, 255, 31, 0, 0, 255, 99, 0, 0, 255,
    ]);
    expect(compareRgbaBounded(first, second, 0)).toMatchObject({ sampledPixels: 4, differentPixels: 1, differenceRatio: 0.25 });
    expect(compareRgbaBounded(first, second, 0, 2).sampledPixels).toBe(2);
  });

  it("normalizes favicon dimensions deterministically", () => {
    expect(normalizeIconSizes([64, 16, 32, 16, 512, 32])).toEqual([16, 32, 64, 512]);
    expect(normalizeIconSizes(undefined)).toEqual([16, 32, 48, 64, 128, 180, 192, 512]);
    expect(() => normalizeIconSizes([0, 32])).toThrow(/Icon size/u);
  });

  it("reuses the existing STORE ZIP and preserves exact input entry order", async () => {
    const files = [
      new File([new Uint8Array([1, 2, 3])], "icon-16.png", { type: "image/png" }),
      new File([new Uint8Array([4, 5])], "icon-32.png", { type: "image/png" }),
    ];
    const created = await createZip({ files });
    expect(created).toMatchObject({ compression: "store" });
    if (!("blob" in created) || !(created.blob instanceof Blob)) throw new Error("ZIP blob missing");
    const archive = new File([created.blob], "icons.zip", { type: "application/zip" });
    const inspected = await inspectZip({ files: [archive] });
    if (!("entries" in inspected) || !Array.isArray(inspected.entries)) throw new Error("ZIP entries missing");
    expect(inspected.entries.map((entry) => entry.path)).toEqual(["icon-16.png", "icon-32.png"]);
    expect(inspected.entries.every((entry) => entry.method === 0)).toBe(true);
  });
});
