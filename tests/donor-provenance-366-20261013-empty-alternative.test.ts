import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditLockedPackages366 } from "../scripts/donor-provenance-366";

type Entry = {
  version?: string;
  license?: string;
  integrity?: string;
  resolved?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};
type Lock = { lockfileVersion: number; packages: Record<string, Entry> };
const actualLock = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")) as Lock;
const actualManifest = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};

function pinnedEntry(name: string): Entry {
  const record = actualLock.packages[`node_modules/${name}`];
  if (!record?.version || !record.license || !record.integrity || !record.resolved) {
    throw new Error(`Missing actual license, registry and sha512-SRI metadata for ${name}`);
  }
  return {
    version: record.version,
    license: record.license,
    integrity: record.integrity,
    resolved: record.resolved,
  };
}

function directRoot(spec: string) {
  if (actualManifest.dependencies.fflate !== "0.8.3" ||
    actualLock.packages[""]?.dependencies?.fflate !== "0.8.3") {
    throw new Error("Expected canonical fflate exact root pin 0.8.3");
  }
  const lock: Lock = {
    lockfileVersion: 3,
    packages: {
      "": { dependencies: { fflate: spec } },
      "node_modules/fflate": pinnedEntry("fflate"),
    },
  };
  expect(lock.packages["node_modules/fflate"]?.version).toBe("0.8.3");
  return { lock, manifest: { dependencies: { fflate: spec } } };
}

function astroEdge(spec: string, optional: boolean) {
  const parent = "@astrojs/internal-helpers";
  const child = "@types/hast";
  const root = pinnedEntry(parent);
  const target = pinnedEntry(child);
  if (actualLock.packages[`node_modules/${parent}`]?.dependencies?.[child] !== "^3.0.4" ||
    root.version !== "0.11.0" || target.version !== "3.0.5") {
    throw new Error("Expected canonical Astro runtime parent and child pins");
  }
  const parentPath = `node_modules/${parent}`;
  const childPath = `node_modules/${child}`;
  const lock: Lock = {
    lockfileVersion: 3,
    packages: {
      "": { dependencies: { [parent]: root.version } },
      [parentPath]: {
        ...root,
        [optional ? "optionalDependencies" : "dependencies"]: { [child]: spec },
      },
      [childPath]: target,
    },
  };
  return { lock, manifest: { dependencies: { [parent]: root.version! } }, parentPath, childPath };
}

// semver@6.3.1 treats an empty OR branch as an unconstrained wildcard.
// All examples below must fail closed despite otherwise intact lock metadata.
const malformedSpecs = ["", "  ", "||", "1 ||", "^9.0.0 ||", "|| ^0.8.3", "^1 || || ^2"];

describe("#366 semver ranges must not gain a wildcard from an empty alternative", () => {
  it("rejects empty and dangling OR branches in actual fflate direct-root metadata", () => {
    for (const spec of malformedSpecs) {
      const { lock, manifest } = directRoot(spec);
      const report = auditLockedPackages366(lock, manifest);
      expect(report.failures, `direct root ${JSON.stringify(spec)}`).toContain(
        `DIRECT_VERSION_MISMATCH fflate (${spec} vs 0.8.3)`,
      );
      expect(report.status).toBe("NO_GO");
    }
  });

  it.each([false, true])("rejects an empty OR alternative for actual Astro edge (optional=%s)", (optional) => {
    for (const spec of ["", " || ", "^99.0.0 ||", "^3.0.4 || || ^4.0.0"]) {
      const { lock, manifest, parentPath, childPath } = astroEdge(spec, optional);
      const report = auditLockedPackages366(lock, manifest);
      const expectedCode = optional ? "OPTIONAL_VERSION_MISMATCH" : "TRANSITIVE_VERSION_MISMATCH";
      expect(report.failures, `${expectedCode} ${JSON.stringify(spec)}`).toContain(
        `${expectedCode} ${parentPath} -> ${childPath} (${spec} vs 3.0.5)`,
      );
      expect(report.status).toBe("NO_GO");
    }
  });

  it("preserves real compatible OR ranges and the existing absent-optional exemption", () => {
    const direct = directRoot("^0.8.0 || ^0.9.0");
    expect(auditLockedPackages366(direct.lock, direct.manifest).status).toBe("VERIFIED_METADATA");
    for (const optional of [false, true]) {
      for (const validSpec of ["^3.0.4 || ^4.0.0", "^3 || ^4"]) {
        const edge = astroEdge(validSpec, optional);
        expect(auditLockedPackages366(edge.lock, edge.manifest).status).toBe("VERIFIED_METADATA");
        if (optional) {
          delete edge.lock.packages[edge.childPath];
          expect(auditLockedPackages366(edge.lock, edge.manifest).status).toBe("VERIFIED_METADATA");
        }
      }
    }
  });
});
