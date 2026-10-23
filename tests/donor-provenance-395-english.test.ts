import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditVendoredAssets366, parseAssetPins366, VENDORED_DIRS_366 } from "../scripts/donor-provenance-366";

const pins = parseAssetPins366(readFileSync("docs/donor-provenance-366-2026-10-11.md", "utf8"));
const modelPath = "public/ocr-395/lang/eng.traineddata.gz";

describe("STR-395 English model provenance", () => {
  it("accepts the recorded English model and still refuses a removed or unrelated pin", () => {
    expect(auditVendoredAssets366(process.cwd(), pins, VENDORED_DIRS_366).failures).toEqual([]);
    const missing = pins.filter((pin) => pin.path !== modelPath);
    expect(auditVendoredAssets366(process.cwd(), missing, VENDORED_DIRS_366).failures)
      .toContain(`UNPINNED_ASSET ${modelPath}`);
    const forged = pins.map((pin) => pin.path === modelPath
      ? { ...pin, source: "https://registry.npmjs.org/unrelated/-/unrelated-1.0.0.tgz" } : pin);
    expect(auditVendoredAssets366(process.cwd(), forged, VENDORED_DIRS_366).failures)
      .toContain(`UNKNOWN_ASSET_SOURCE ${modelPath}`);
  }, 30_000);
});
