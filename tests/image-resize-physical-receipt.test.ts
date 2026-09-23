import { describe, expect, it } from "vitest";
import { IMAGE_LIMITS } from "../src/engines/image/policy";
import { buildPhysicalImageReceipt, validatePhysicalImageReceipt } from "../scripts/lib/image-resize-physical";

const checks = {
  filesOrPhotosPicker: "PASS" as const,
  resizeCompleted: "PASS" as const,
  verifiedDownloadOpened: "PASS" as const,
  noCrashOrReload: "PASS" as const,
  mobileLayoutUsable: "PASS" as const,
  boundaryPolicyCase: "PASS" as const,
};

describe("physical Image Resize receipt", () => {
  it("builds a self-consistent iOS Safari receipt from an observed source/output pair", () => {
    const receipt = buildPhysicalImageReceipt({
      target: "ios-safari",
      device: "iPhone test device / iOS 20",
      browser: "Mobile Safari 20",
      sourceWidth: 4000,
      sourceHeight: 4000,
      outputWidth: 1200,
      outputHeight: 1200,
      checks,
      observedAt: "2026-09-23T20:00:00Z",
    });
    expect(receipt.maxSourcePixelsTested).toBe(16_000_000);
    expect(receipt.policyLimits).toEqual(IMAGE_LIMITS);
    expect(receipt.thresholdCoverage.sourcePixelLimitFraction).toBe(1);
    expect(validatePhysicalImageReceipt(receipt, "ios-safari")).toEqual([]);
  });

  it("rejects target/browser mismatch and policy-inconsistent measurements", () => {
    expect(() => buildPhysicalImageReceipt({
      target: "android-chrome",
      device: "Android test device",
      browser: "Safari 20",
      sourceWidth: 4000,
      sourceHeight: 4000,
      outputWidth: 1200,
      outputHeight: 1200,
      checks,
    })).toThrow(/Chrome/u);

    const receipt = buildPhysicalImageReceipt({
      target: "android-chrome",
      device: "Android test device",
      browser: "Chrome 153",
      sourceWidth: 4000,
      sourceHeight: 4000,
      outputWidth: 1200,
      outputHeight: 1200,
      checks,
    });
    expect(validatePhysicalImageReceipt({ ...receipt, maxSourcePixelsTested: 123 }, "android-chrome")).toContain("maxSourcePixelsTested does not match source dimensions");
  });

  it("refuses an ordinary 12MP phone photo as proof of the 16MP policy boundary", () => {
    expect(() => buildPhysicalImageReceipt({
      target: "ios-safari",
      device: "iPhone test device",
      browser: "Mobile Safari 20",
      sourceWidth: 4032,
      sourceHeight: 3024,
      outputWidth: 1200,
      outputHeight: 900,
      checks,
    })).toThrow(/95%/u);
  });
});
