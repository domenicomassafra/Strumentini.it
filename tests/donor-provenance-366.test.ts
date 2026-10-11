import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { auditLockedPackages366, auditVendoredAssets366, auditCandidate366, type AssetPin366 } from "../scripts/donor-provenance-366";

const integrity = `sha512-${Buffer.alloc(64, 23).toString("base64")}`;
const resolved = (name: string, version: string) => `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-${version}.tgz`;
const baseLock = () => ({
  lockfileVersion: 3, packages: {
    "": { dependencies: { encoder: "1.0.0" } },
    "node_modules/encoder": { version: "1.0.0", license: "MIT", integrity, resolved: resolved("encoder", "1.0.0"), dependencies: { nested: "^2" } },
    "node_modules/nested": { version: "2.0.0", license: "Apache-2.0", integrity, resolved: resolved("nested", "2.0.0") },
  },
});

describe("#366 license, source and asset provenance decision boundary", () => {
  it("audits actual transitive runtime nodes with pinned registry sources, versions and SRI", () => {
    const report = auditLockedPackages366(baseLock(), { dependencies: { encoder: "1.0.0" }, devDependencies: {} });
    expect(report.status).toBe("VERIFIED_METADATA");
    expect(report.rows.map((r) => `${r.name}@${r.version}:${r.license}`)).toEqual(["encoder@1.0.0:MIT", "nested@2.0.0:Apache-2.0"]);
  });

  it("fails closed if transitive license, source, integrity or dependency is missing or malformed", () => {
    const corruptions = [
      (lock: ReturnType<typeof baseLock>) => { delete (lock.packages["node_modules/nested"] as { license?: string }).license; },
      (lock: ReturnType<typeof baseLock>) => { lock.packages["node_modules/nested"].license = "NOASSERTION"; },
      (lock: ReturnType<typeof baseLock>) => { lock.packages["node_modules/nested"].integrity = "sha512-not-a-real-digest"; },
      (lock: ReturnType<typeof baseLock>) => { lock.packages["node_modules/nested"].resolved = "https://untrusted.example/nested.tgz"; },
      (lock: ReturnType<typeof baseLock>) => { delete (lock.packages as Record<string, unknown>)["node_modules/nested"]; },
    ];
    for (const corrupt of corruptions) {
      const lock = baseLock(); corrupt(lock);
      const report = auditLockedPackages366(lock, { dependencies: { encoder: "1.0.0" } });
      expect(report.status).toBe("NO_GO");
      expect(report.failures.length).toBeGreaterThan(0);
    }
  });

  it("flags a new, missing or changed vendored asset and license/source unknown", () => {
    const root = mkdtempSync(join(tmpdir(), "donor-366-"));
    try {
      mkdirSync(join(root, "vendor"));
      writeFileSync(join(root, "vendor/codec.wasm"), Buffer.from("known WASM"));
      const sha256 = createHash("sha256").update("known WASM").digest("hex");
      const assets: AssetPin366[] = [{ path: "vendor/codec.wasm", sha256, license: "Apache-2.0", source: "https://registry.npmjs.org/codec/-/codec-1.0.0.tgz", version: "1.0.0" }];
      expect(auditVendoredAssets366(root, assets, ["vendor"]).status).toBe("VERIFIED_METADATA");
      expect(auditVendoredAssets366(root, [{ ...assets[0]!, source: "" }], ["vendor"]).status).toBe("NO_GO");
      expect(auditVendoredAssets366(root, [{ ...assets[0]!, source: "https://evil.example/codec-1.0.0.tgz" }], ["vendor"]).status).toBe("NO_GO");
      expect(auditVendoredAssets366(root, [{ ...assets[0]!, source: "https://registry.npmjs.org/codec/-/codec-2.0.0.tgz" }], ["vendor"]).status).toBe("NO_GO");
      writeFileSync(join(root, "vendor/codec.wasm"), "altered");
      expect(auditVendoredAssets366(root, assets, ["vendor"]).failures).toContain("ASSET_HASH_MISMATCH vendor/codec.wasm");
      writeFileSync(join(root, "vendor/extra.wasm"), "new unknown asset");
      expect(auditVendoredAssets366(root, assets, ["vendor"]).failures).toContain("UNPINNED_ASSET vendor/extra.wasm");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("never promotes a donor on snapshot metadata alone; refuses unknown or contradictory license/integrity", () => {
    const candidate = { name: "codec", version: "1.0.0", license: "Apache-2.0", dist: { integrity, tarball: resolved("codec", "1.0.0") }, dependencies: null };
    expect(auditCandidate366(candidate, null).decision).toBe("NO_ADOPT");
    expect(auditCandidate366({ ...candidate, license: "NOASSERTION" }, null).failures).toContain("UNKNOWN_LICENSE codec@1.0.0");
    expect(auditCandidate366({ ...candidate, dist: { ...candidate.dist, integrity: "sha512-bad" } }, null).decision).toBe("NO_ADOPT");
    expect(auditCandidate366({ ...candidate, dependencies: { missing: "^2.0.0" } }, null).failures).toContain("UNVERIFIED_TRANSITIVE missing for codec@1.0.0");
  });

  it("accepts recorded installed transitive candidate edges only when they match the lockfile", () => {
    const candidate = { name: "encoder", version: "1.0.0", license: "MIT", dist: { integrity, tarball: resolved("encoder", "1.0.0") }, dependencies: { nested: "^2" } };
    const lock = baseLock();
    const checked = auditCandidate366(candidate, lock.packages["node_modules/encoder"], lock);
    expect(checked.failures).toEqual([]);
    expect(checked.decision).toBe("NO_ADOPT");
    lock.packages["node_modules/encoder"].dependencies.nested = "^3";
    expect(auditCandidate366(candidate, lock.packages["node_modules/encoder"], lock).failures).toContain("UNVERIFIED_TRANSITIVE nested for encoder@1.0.0");
  });
});
