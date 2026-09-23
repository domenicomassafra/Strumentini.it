import { describe, expect, it } from "vitest";
import { IMAGE_LIMITS } from "../src/engines/image/policy";
import { buildPhysicalImageReceipt, validatePhysicalImageReceipt } from "../scripts/lib/image-resize-physical";

const checks = {
  filesOrPhotosPicker: "PASS" as const,
  resizeCompleted: "PASS" as const,
  verifiedDownloadOpened: "PASS" as const,
  noCrashOrReload: "PASS" as const,
  mobileLayoutUsable: "PASS" as const,
};

describe("physical Image Resize receipt", () => {
  it("builds a self-consistent iOS Safari receipt from an observed source/output pair", () => {
    const receipt = buildPhysicalImageReceipt({
      target: "ios-safari",
      device: "iPhone test device / iOS 20",
      browser: "Mobile Safari 20",
      sourceWidth: 4032,
      sourceHeight: 3024,
      outputWidth: 1200,
      outputHeight: 900,
      checks,
      observedAt: "2026-09-23T20:00:00Z",
    });
    expect(receipt.maxSourcePixelsTested).toBe(12_192_768);
    expect(receipt.policyLimits).toEqual(IMAGE_LIMITS);
    expect(validatePhysicalImageReceipt(receipt, "ios-safari")).toEqual([]);
  });

  it("rejects target/browser mismatch and policy-inconsistent measurements", () => {
    expect(() => buildPhysicalImageReceipt({
      target: "android-chrome",
      device: "Android test device",
      browser: "Safari 20",
      sourceWidth: 1000,
      sourceHeight: 1000,
      outputWidth: 500,
      outputHeight: 500,
      checks,
    })).toThrow(/Chrome/u);

    const receipt = buildPhysicalImageReceipt({
      target: "android-chrome",
      device: "Android test device",
      browser: "Chrome 153",
      sourceWidth: 1000,
      sourceHeight: 1000,
      outputWidth: 500,
      outputHeight: 500,
      checks,
    });
    expect(validatePhysicalImageReceipt({ ...receipt, maxSourcePixelsTested: 123 }, "android-chrome")).toContain("maxSourcePixelsTested does not match source dimensions");
  });
});
