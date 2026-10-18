/** An asset's npm URL must identify its recorded distribution, not merely
 * a registry host and a version-shaped filename. No donor is adopted here. */
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditVendoredAssets366, parseAssetPins366 } from "../scripts/donor-provenance-366";

const registry = parseAssetPins366(readFileSync(resolve("docs/donor-provenance-366-2026-10-11.md"), "utf8"));

function auditPinnedFile(path: string, altered: { source?: string; license?: string; version?: string }) {
  const actual = registry.find((item) => item.path === path);
  if (!actual) throw new Error(`Missing authentic #366 asset pin: ${path}`);
  const root = mkdtempSync(join(tmpdir(), "donor-366-asset-origin-"));
  const originalBytes = readFileSync(resolve(path));
  try {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    copyFileSync(resolve(path), join(root, path));
    expect(createHash("sha256").update(originalBytes).digest("hex")).toBe(actual.sha256);
    return auditVendoredAssets366(root, [{ ...actual, ...altered }], [dirname(path)]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("#366 vendored asset source identity", () => {
  it("retains the metadata-only result for the recorded genuine Tesseract license", () => {
    const path = "public/ocr-246/vendor/tesseract-js-APACHE-2.0.LICENSE";
    expect(auditPinnedFile(path, {}).status).toBe("VERIFIED_METADATA");
  });

  it.each([
    "https://registry.npmjs.org/fake/-/fake-7.0.0.tgz",
    "https://registry.npmjs.org/tesseract.js/-/unrelated-7.0.0.tgz",
    "https://registry.npmjs.org/@different/tesseract.js/-/tesseract.js-7.0.0.tgz",
  ])("refuses a valid-looking but unrelated npm source %s", (source) => {
    const path = "public/ocr-246/vendor/tesseract-js-APACHE-2.0.LICENSE";
    const result = auditPinnedFile(path, { source });
    expect(result.status).toBe("NO_GO");
    expect(result.failures).toContain(`UNKNOWN_ASSET_SOURCE ${path}`);
  });

  it("refuses to infer font ownership from a plausible npm URL", () => {
    const path = "public/fonts/inter-latin.woff2";
    const result = auditPinnedFile(path, {
      license: "MIT", version: "1.0.0",
      source: "https://registry.npmjs.org/fake-font/-/fake-font-1.0.0.tgz",
    });
    expect(result.status).toBe("NO_GO");
    expect(result.failures).toContain(`UNKNOWN_ASSET_SOURCE ${path}`);
  });
});
