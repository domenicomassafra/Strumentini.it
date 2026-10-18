import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditLockedPackages366 } from "../scripts/donor-provenance-366";

const actualManifest = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};
const actualLock = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")) as {
  packages: Record<string, {
    version?: string; license?: string; integrity?: string; resolved?: string;
    dependencies?: Record<string, string>;
  }>;
};

/** Copy real pinned registry/license/SRI evidence into a hermetic optional-root graph. */
function optionalRoot(spec: string, present = true) {
  const name = "fflate";
  const pinned = actualLock.packages["node_modules/fflate"];
  if (actualManifest.dependencies[name] !== "0.8.3" ||
      actualLock.packages[""]?.dependencies?.[name] !== "0.8.3" ||
      pinned?.version !== "0.8.3" || pinned.license !== "MIT" ||
      !pinned.integrity || !pinned.resolved) {
    throw new Error("Missing original installed fflate@0.8.3 pin");
  }
  const entry = {
    version: pinned.version,
    license: pinned.license,
    integrity: pinned.integrity,
    resolved: pinned.resolved,
  };
  const packages: Record<string, {
    optionalDependencies?: Record<string, string>;
    version?: string; license?: string; integrity?: string; resolved?: string;
    dev?: boolean; devOptional?: boolean;
  }> = {
    "": { optionalDependencies: { fflate: spec } },
  };
  if (present) packages["node_modules/fflate"] = entry;
  return {
    lock: { lockfileVersion: 3, packages },
    manifest: { optionalDependencies: { fflate: spec } },
  };
}

describe("#366 root optionalDependencies resolve against the installed version", () => {
  it("refuses an installed incompatible optional root, using actual pinned fflate metadata", () => {
    const { lock, manifest } = optionalRoot("^99.0.0");
    const result = auditLockedPackages366(lock, manifest);
    expect(result.status).toBe("NO_GO");
    expect(result.failures).toContain("ROOT_OPTIONAL_VERSION_MISMATCH fflate (^99.0.0 vs 0.8.3)");
  });

  it("retains the matching exact and compatible range optional roots", () => {
    for (const spec of ["0.8.3", "^0.8.0", "^0.8.0 || ^0.9.0"]) {
      const { lock, manifest } = optionalRoot(spec);
      expect(auditLockedPackages366(lock, manifest), spec).toMatchObject({ status: "VERIFIED_METADATA", failures: [] });
    }
  });

  it("permits truly absent optional root entries even when the declaration is present", () => {
    const { lock, manifest } = optionalRoot("^99.0.0", false);
    expect(auditLockedPackages366(lock, manifest)).toMatchObject({ status: "VERIFIED_METADATA", failures: [] });
  });

  it("rejects root optional declaration drift between package.json and package-lock.json", () => {
    const { lock, manifest } = optionalRoot("^0.8.0");
    lock.packages[""]!.optionalDependencies = { fflate: "^99.0.0" };
    const result = auditLockedPackages366(lock, manifest);
    expect(result.status).toBe("NO_GO");
    expect(result.failures).toContain("ROOT_OPTIONAL_DEPENDENCIES_DIFFER");
  });

  it("refuses malformed OR and true dev, but verifies present devOptional roots", () => {
    const badRange = optionalRoot("^99.0.0 ||");
    const invalid = auditLockedPackages366(badRange.lock, badRange.manifest);
    expect(invalid.status).toBe("NO_GO");
    expect(invalid.failures).toContain("ROOT_OPTIONAL_VERSION_MISMATCH fflate (^99.0.0 || vs 0.8.3)");

    const dev = optionalRoot("0.8.3");
    dev.lock.packages["node_modules/fflate"]!.dev = true;
    expect(auditLockedPackages366(dev.lock, dev.manifest).failures)
      .toContain("DEV_ONLY_ROOT_OPTIONAL fflate -> node_modules/fflate");
    const optional = optionalRoot("0.8.3");
    optional.lock.packages["node_modules/fflate"]!.devOptional = true;
    expect(auditLockedPackages366(optional.lock, optional.manifest))
      .toMatchObject({ status: "VERIFIED_METADATA", failures: [] });
    optional.lock.packages["node_modules/fflate"]!.integrity = "sha512-bogus";
    expect(auditLockedPackages366(optional.lock, optional.manifest).failures)
      .toContain("INVALID_SRI node_modules/fflate");
  });
});
