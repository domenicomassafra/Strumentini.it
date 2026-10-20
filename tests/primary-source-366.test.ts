import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  PRIMARY_SOURCE_366_MANIFEST,
  verifyPrimarySource366,
  type PrimarySource366Manifest,
} from "../scripts/verify-primary-source-366";

const root = resolve(import.meta.dirname, "..");
const original = JSON.parse(readFileSync(resolve(root, PRIMARY_SOURCE_366_MANIFEST), "utf8")) as PrimarySource366Manifest;

describe("STR-366 primary source assets: offline fail-closed evidence", () => {
  it("pins every shipped OCR/font asset, includes all OFL copyrights and preserves NO_GO", () => {
    expect(verifyPrimarySource366(root)).toEqual({
      decision: "NO_GO",
      files: 26,
      exactUpstream: 26,
      unresolved: 0,
      failures: [],
    });
  });

  it("documents the byte digest, source URL and obligation of every single pinned asset", () => {
    const document = readFileSync(resolve(root, "docs/primary-source-366-2026-10-18.md"), "utf8");
    for (const asset of original.assets) {
      expect(document, asset.path).toContain(asset.path);
      expect(document, asset.path).toContain(asset.sha256);
      if (asset.sourceUrl !== null) expect(document, asset.path).toContain(asset.sourceUrl);
      expect(document, asset.path).toContain(asset.obligation);
    }
    expect(document).toContain("NO_GO");
  });

  it("detects even a one-digit SHA-256 change without network or file mutation", () => {
    const altered = structuredClone(original);
    const first = altered.assets.find((entry) => entry.path === "public/fonts/inter-latin.woff2");
    expect(first).toBeDefined();
    first!.sha256 = "0".repeat(64);
    expect(verifyPrimarySource366(root, altered).failures)
      .toContain("LOCAL_BYTE_MISMATCH public/fonts/inter-latin.woff2");
  });

  it("refuses to restore the fake MIT template as a shipped asset", () => {
    expect(existsSync(resolve(root, "public/ocr-246/lang/NPM-PACKAGE-MIT.LICENSE"))).toBe(false);
    const altered = structuredClone(original);
    altered.assets.push({
      path: "public/ocr-246/lang/NPM-PACKAGE-MIT.LICENSE", bytes: 1078,
      sha256: "b05785f9f18e6716bab63424b11454513b9943a222595b70411009202fc592b5",
      evidence: "EXACT_UPSTREAM_BYTES", sourceKind: "local-unattributed-mit-template",
      sourceUrl: null, obligation: "ocr-ita",
    });
    expect(verifyPrimarySource366(root, altered).failures)
      .toContain("PINNED_ASSET_NOT_DISTRIBUTED public/ocr-246/lang/NPM-PACKAGE-MIT.LICENSE");
  });
  it("rejects a changed historical model attribution even when the compressed bytes still match", () => {
    const altered = structuredClone(original);
    const model = altered.assets.find((entry) => entry.path.endsWith("/ita.traineddata.gz"))!;
    model.originalUncompressedSha256 = "0".repeat(64);
    expect(verifyPrimarySource366(root, altered).failures)
      .toContain("ITALIAN_MODEL_GIT_SOURCE_NOT_PINNED");
  });

  it("fails when an upstream URL is forged even if local SHA-256 remains correct", () => {
    const altered = structuredClone(original);
    const source = altered.assets.find((entry) => entry.path === "public/fonts/inter-latin.woff2");
    expect(source).toBeDefined();
    source!.sourceUrl = "https://fonts.gstatic.com/s/inter/v99/not-the-observed-bytes.woff2";
    expect(verifyPrimarySource366(root, altered).failures).toContain("MANIFEST_ATTESTATION_MISMATCH");
  });

  it("rejects omission of a shipped WOFF2, even if other hashes remain correct", () => {
    const altered = structuredClone(original);
    altered.assets = altered.assets.filter((entry) => entry.path !== "public/fonts/archivo-latin-ext.woff2");
    expect(verifyPrimarySource366(root, altered).failures)
      .toContain("UNPINNED_DISTRIBUTED_ASSET public/fonts/archivo-latin-ext.woff2");
  });

  it("requires official OFL evidence rather than a missing attribution file", () => {
    const altered = structuredClone(original);
    altered.assets = altered.assets.filter((entry) => entry.path !== "public/fonts/inter-OFL-1.1.txt");
    expect(verifyPrimarySource366(root, altered).failures)
      .toContain("UNPINNED_DISTRIBUTED_ASSET public/fonts/inter-OFL-1.1.txt");
  });

  it("refuses to read a symlink masquerading as an official font", () => {
    const temp = mkdtempSync(resolve(tmpdir(), "str-366-symlink-"));
    try {
      mkdirSync(resolve(temp, "public/fonts"), { recursive: true });
      mkdirSync(resolve(temp, "public/ocr-246"), { recursive: true });
      symlinkSync(resolve(root, "public/fonts/inter-latin.woff2"), resolve(temp, "public/fonts/inter-latin.woff2"));
      expect(verifyPrimarySource366(temp, original).failures)
        .toContain("MISSING_OR_NONREGULAR_ASSET public/fonts/inter-latin.woff2");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("refuses two symlinked shipped asset directories even when every upstream byte matches", () => {
    const temp = mkdtempSync(resolve(tmpdir(), "str-366-parent-symlink-"));
    try {
      mkdirSync(resolve(temp, "public"));
      symlinkSync(resolve(root, "public/fonts"), resolve(temp, "public/fonts"), "dir");
      symlinkSync(resolve(root, "public/ocr-246"), resolve(temp, "public/ocr-246"), "dir");
      const report = verifyPrimarySource366(temp, original);
      expect(report.failures).toContain("UNSAFE_ASSET_DIRECTORY public/fonts");
      expect(report.failures).toContain("UNSAFE_ASSET_DIRECTORY public/ocr-246");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("rejects a nested OCR directory symlink without reading its target", () => {
    const temp = mkdtempSync(resolve(tmpdir(), "str-366-nested-symlink-"));
    try {
      mkdirSync(resolve(temp, "public/ocr-246"), { recursive: true });
      mkdirSync(resolve(temp, "public/fonts"), { recursive: true });
      symlinkSync(resolve(root, "public/ocr-246/core"), resolve(temp, "public/ocr-246/core"), "dir");
      expect(verifyPrimarySource366(temp, original).failures)
        .toContain("UNSAFE_ASSET_PATH public/ocr-246/core");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("rejects a symlinked public ancestor before visiting either shipped asset subtree", () => {
    const temp = mkdtempSync(resolve(tmpdir(), "str-366-public-symlink-"));
    try {
      symlinkSync(resolve(root, "public"), resolve(temp, "public"), "dir");
      const report = verifyPrimarySource366(temp, original);
      expect(report.failures).toContain("UNSAFE_ASSET_DIRECTORY public/fonts");
      expect(report.failures).toContain("UNSAFE_ASSET_DIRECTORY public/ocr-246");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("rejects a symlinked evidence manifest before attempting to read external bytes", () => {
    const temp = mkdtempSync(resolve(tmpdir(), "str-366-manifest-symlink-"));
    try {
      mkdirSync(resolve(temp, "quality/reference-data"), { recursive: true });
      symlinkSync(resolve(root, PRIMARY_SOURCE_366_MANIFEST), resolve(temp, PRIMARY_SOURCE_366_MANIFEST));
      expect(verifyPrimarySource366(temp).failures).toContain("UNSAFE_SOURCE_MANIFEST");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("rejects a symlinked root rather than trusting an external manifest and assets", () => {
    const temp = mkdtempSync(resolve(tmpdir(), "str-366-root-symlink-"));
    try {
      symlinkSync(root, resolve(temp, "project"), "dir");
      expect(verifyPrimarySource366(resolve(temp, "project"), original).failures)
        .toContain("UNSAFE_ASSET_ROOT");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("disallows an unrecognized upstream tarball integrity or license source", () => {
    const altered = structuredClone(original);
    altered.primaryNpmTarballs["tesseract-core"]!.integrity = "sha512-not-an-authentic-hash";
    expect(verifyPrimarySource366(root, altered).failures)
      .toContain("INVALID_NPM_SOURCE tesseract-core");
  });

  it("rejects a substituted npm distribution even if all linked asset URLs and the SRI are coherent", () => {
    const altered = structuredClone(original);
    const forged = "https://registry.npmjs.org/arbitrary-package/-/fake-99.0.0.tgz?untrusted=1";
    altered.primaryNpmTarballs["tesseract-core"]!.url = forged;
    for (const asset of altered.assets) {
      if (asset.packageId === "tesseract-core") asset.sourceUrl = forged;
    }
    const failures = verifyPrimarySource366(root, altered).failures;
    expect(failures).toContain("INVALID_NPM_SOURCE tesseract-core");
    expect(failures).toContain("MANIFEST_ATTESTATION_MISMATCH");
  });

  it("rejects queries and fragments on an otherwise authentic npm tarball path", () => {
    for (const suffix of ["?download=1", "#integrity"]) {
      const altered = structuredClone(original);
      altered.primaryNpmTarballs["italian-model"]!.url += suffix;
      expect(verifyPrimarySource366(root, altered).failures)
        .toContain("INVALID_NPM_SOURCE italian-model");
    }
  });
});
