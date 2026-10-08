import { describe, expect, it } from "vitest";
import { normalizePdfRenderOptions, selectedPdfRasterPages } from "../src/engines/pdf/render";
import { friendlyToolErrorIt } from "../src/i18n/it/errors";

describe("236 — PDF raster export input contract", () => {
  it("supports true page intervals and preserves explicit order", () => {
    expect(selectedPdfRasterPages(8, "3-5, 1, 8")).toEqual([3, 4, 5, 1, 8]);
    expect(selectedPdfRasterPages(3)).toEqual([1, 2, 3]);
    expect(selectedPdfRasterPages(3, [3, 1])).toEqual([3, 1]);
    expect(selectedPdfRasterPages(4, "tutte")).toEqual([1, 2, 3, 4]);
  });

  it.each(["1-5", "5-3", "1, 1", "1, bad", "", "0", "2,", "1-999", "1-2,2"])(
    "refuses invalid range expression %s instead of silently dropping a page", (selection) => {
      expect(() => selectedPdfRasterPages(4, selection)).toThrow();
    },
  );

  it("validates background, MIME, scale and quality independently without loading a transcoder", () => {
    expect(normalizePdfRenderOptions({})).toEqual({ mime: "image/png", scale: 2, quality: 0.92, background: "#ffffff" });
    expect(normalizePdfRenderOptions({ mime: "image/jpeg", scale: 1, quality: 0.6, background: "#Ab12CD" })).toEqual({
      mime: "image/jpeg", scale: 1, quality: 0.6, background: "#ab12cd",
    });
    expect(normalizePdfRenderOptions({ mime: "image/webp", background: "#000000" }).background).toBe("#000000");
    for (const background of ["white", "#fff", "#ffffff00", "#zzzzzz", ""])
      expect(() => normalizePdfRenderOptions({ background })).toThrow(/background/u);
    for (const scale of [0, 0.25, 4.01, Infinity, NaN])
      expect(() => normalizePdfRenderOptions({ scale })).toThrow(/scale/u);
    for (const quality of [0, 0.01, 1.01, Infinity, NaN])
      expect(() => normalizePdfRenderOptions({ quality })).toThrow(/quality/u);
  });

  it("makes unavailable native WebP encoding actionable instead of naming an unverified artifact", () => {
    expect(friendlyToolErrorIt("PDF_WEBP_UNSUPPORTED_BROWSER: This browser cannot encode WebP locally."))
      .toContain("Seleziona PNG o JPG");
  });
});
