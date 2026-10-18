/** Regression against recorded lock and git-pinned locally authored files.
 * This test never changes a lockfile, vendor payload, or a license claim. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditLockedPackages366, auditVendoredAssets366, parseAssetPins366, VENDORED_DIRS_366 } from "../scripts/donor-provenance-366";

const lock = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8"));
const manifest = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const pins = parseAssetPins366(readFileSync(resolve("docs/donor-provenance-366-2026-10-11.md"), "utf8"));
const authored = [
  "src/engines/pdf/vendor/pdfstudio/PROVENANCE.md",
  "src/engines/video/vendor/gifenc-mit-1.0.3/README.md",
  "src/engines/video/vendor/gifenc-mit-1.0.3/index.d.mts",
  "src/engines/video/vendor/mediabunny-mpl-1.61.3/README.md",
] as const;

describe("#366 false refusals versus real provenance blockers", () => {
  it("audits all seven present devOptional edges rather than treating them as dev-only", () => {
    const report = auditLockedPackages366(lock, manifest);
    expect(report.failures.filter((failure: string) => /DEV_ONLY_(TRANSITIVE|OPTIONAL)/u.test(failure))).toEqual([]);
    expect(report.failures).not.toContain("UNKNOWN_LICENSE node_modules/tslib");
    expect(report.optionalInstalled.map((row) => row.name)).toEqual(expect.arrayContaining([
      "@napi-rs/wasm-runtime", "@emnapi/runtime", "tslib", "sharp",
    ]));
    expect(report.optionalInstalled.every((row) => row.scope === "optional-runtime")).toBe(true);
  });

  it("still refuses malformed provenance on a present optional transitive node", () => {
    const broken = structuredClone(lock);
    broken.packages["node_modules/@napi-rs/wasm-runtime"].integrity = "sha512-forged";
    const report = auditLockedPackages366(broken, manifest);
    expect(report.status).toBe("NO_GO");
    expect(report.failures).toContain("INVALID_SRI node_modules/@napi-rs/wasm-runtime");
  });

  it("checks the current 0BSD tslib license syntax, without legal approval", () => {
    expect(lock.packages["node_modules/tslib"].license).toBe("0BSD");
    const report = auditLockedPackages366(lock, manifest);
    expect(report.failures).not.toContain("UNKNOWN_LICENSE node_modules/tslib");
    const broken = structuredClone(lock);
    broken.packages["node_modules/tslib"].license = "0BSD OR NOASSERTION";
    expect(auditLockedPackages366(broken, manifest).failures).toContain("UNKNOWN_LICENSE node_modules/tslib");
  });

  it("recognizes only the four exact locally authored git-pinned files", () => {
    const report = auditVendoredAssets366(process.cwd(), pins, VENDORED_DIRS_366);
    for (const path of authored) {
      expect(report.failures.filter((failure) => failure.endsWith(" " + path)), path).toEqual([]);
      const pin = pins.find((item) => item.path === path)!;
      expect(pin.license).toBe("LOCAL_AUTHORED");
      expect(pin.version).toBe("GIT");
      expect(pin.source).toMatch(/^git:[a-f0-9]{40}:[a-f0-9]{40}$/u);
    }
    expect(report.status).toBe("NO_GO");
    expect(report.failures.filter((failure) => failure.includes("public/fonts/")).length).toBe(24);
    expect(report.failures.filter((failure) => failure.includes("public/ocr-246/")).length).toBe(17);
  });

  it("rejects forged or repurposed LOCAL_AUTHORED attribution", () => {
    const original = pins.find((item) => item.path === authored[0])!;
    const attacks = [
      { ...original, source: "git:" + "a".repeat(40) + ":" + "b".repeat(40) },
      { ...original, source: "git:" + "f".repeat(40) + ":" + original.source.split(":")[2] },
      { ...original, license: "MIT" },
      { ...original, sha256: "a".repeat(64) },
      { ...original, path: "src/engines/pdf/vendor/pdfstudio/wasm/qpdf.wasm" },
    ];
    for (const attack of attacks) {
      const modified = pins.map((item) => item.path === original.path ? attack : item);
      const report = auditVendoredAssets366(process.cwd(), modified, VENDORED_DIRS_366);
      expect(report.status).toBe("NO_GO");
      expect(report.failures.some((failure) => failure.includes("LOCAL_AUTHORED") ||
        failure.startsWith("ASSET_HASH_MISMATCH") || failure.startsWith("INVALID_ASSET_PATH") ||
        failure.startsWith("UNPINNED_ASSET")), JSON.stringify(attack)).toBe(true);
    }
  });
});
