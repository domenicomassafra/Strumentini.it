import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditLockedPackages366 } from "../scripts/donor-provenance-366";

type Entry = {
  version?: string; license?: string; integrity?: string; resolved?: string;
  dependencies?: Record<string, string>; optionalDependencies?: Record<string, string>;
};
type Lock = { lockfileVersion: number; packages: Record<string, Entry> };

const actualLock = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")) as Lock;
const tarballOf = (name: string, version: string) =>
  `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-${version}.tgz`;

/**
 * Uses actual installed Astro parent/child metadata, including lock-recorded
 * license and sha512 SRI, without writing the real manifest or lockfile.
 * Isolates one runtime edge so unrelated real NO_GO cases do not mask RED.
 */
function lockedAstroEdge(parentName: string, dependencyName: string) {
  const parentKey = `node_modules/${parentName}`;
  const childKey = `node_modules/${dependencyName}`;
  const parent = actualLock.packages[parentKey];
  const child = actualLock.packages[childKey];
  const declaredRange = parent?.dependencies?.[dependencyName];
  if (!parent?.version || !parent.integrity || !parent.resolved || !parent.license ||
    !child?.version || !child.integrity || !child.resolved || !child.license || !declaredRange) {
    throw new Error(`Missing installed, pinned runtime metadata for ${parentName} -> ${dependencyName}`);
  }
  const lock: Lock = {
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { [parentName]: parent.version } },
        [parentKey]: {
          version: parent.version, license: parent.license, integrity: parent.integrity,
          resolved: parent.resolved, dependencies: { [dependencyName]: declaredRange },
        },
        [childKey]: {
          version: child.version, license: child.license, integrity: child.integrity,
          resolved: child.resolved,
        },
      },
  };
  return {
    childKey, declaredRange,
    manifest: { dependencies: { [parentName]: parent.version } },
    lock,
  };
}

describe("#366 transitive lockfile pinning: effective resolved version", () => {
  it.each([
    ["@astrojs/compiler-rs", "@astrojs/compiler-binding", "0.4.2"],
    ["@astrojs/internal-helpers", "@types/hast", "99.0.0"],
  ] as const)(
    "refuses %s's %s resolved to an incompatible version, even with a well-shaped registry URL and SRI",
    (parent, dep, incompatible) => {
      const { lock, manifest, declaredRange, childKey } = lockedAstroEdge(parent, dep);
      expect(declaredRange).toBe(parent === "@astrojs/compiler-rs" ? "0.4.1" : "^3.0.4");
      expect(auditLockedPackages366(lock, manifest).status).toBe("VERIFIED_METADATA");
      // Simulate a disagreeing lock record that has otherwise plausible
      // metadata, rather than poisoning SRI shape or source hostname.
      const original = lock.packages[childKey]!;
      lock.packages[childKey] = {
        ...original,
        version: incompatible,
        resolved: tarballOf(dep, incompatible),
      };
      const result = auditLockedPackages366(lock, manifest);
      expect(result.failures).toContain(
        `TRANSITIVE_VERSION_MISMATCH node_modules/${parent} -> ${childKey} (${declaredRange} vs ${incompatible})`,
      );
      expect(result.status).toBe("NO_GO");
    },
  );

  it("refuses an incompatible installed optional runtime edge, but leaves absent optional packages optional", () => {
    const parent = "@astrojs/internal-helpers";
    const dep = "@types/hast";
    const { lock, manifest, declaredRange, childKey } = lockedAstroEdge(parent, dep);
    const entry = lock.packages[`node_modules/${parent}`]!;
    entry.dependencies = {};
    entry.optionalDependencies = { [dep]: declaredRange };
    expect(auditLockedPackages366(lock, manifest).status).toBe("VERIFIED_METADATA");
    const child = lock.packages[childKey]!;
    lock.packages[childKey] = { ...child, version: "99.0.0", resolved: tarballOf(dep, "99.0.0") };
    const result = auditLockedPackages366(lock, manifest);
    expect(result.failures).toContain(
      `OPTIONAL_VERSION_MISMATCH node_modules/${parent} -> ${childKey} (${declaredRange} vs 99.0.0)`,
    );
    expect(result.status).toBe("NO_GO");
    delete lock.packages[childKey];
    expect(auditLockedPackages366(lock, manifest).status).toBe("VERIFIED_METADATA");
  });
});
