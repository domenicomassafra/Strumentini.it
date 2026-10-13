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
};
type Lock = { lockfileVersion: number; packages: Record<string, Entry> };

const actualManifest = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};
const actualLock = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")) as Lock;

/** Isolate one genuine installed root edge without altering repository metadata. */
function installedRootEdge(name: string) {
  const key = `node_modules/${name}`;
  const spec = actualManifest.dependencies[name];
  const lockedSpec = actualLock.packages[""]?.dependencies?.[name];
  const installed = actualLock.packages[key];
  if (!spec || spec !== lockedSpec || !installed?.version || !installed.license ||
      !installed.integrity || !installed.resolved) {
    throw new Error(`Missing actual pinned root metadata for ${name}`);
  }
  const lock: Lock = {
    lockfileVersion: 3,
    packages: {
      "": { dependencies: { [name]: spec } },
      [key]: {
        version: installed.version,
        license: installed.license,
        integrity: installed.integrity,
        resolved: installed.resolved,
      },
    },
  };
  return { spec, key, lock, manifest: { dependencies: { [name]: spec } } };
}

const matchingRegistrySource = (name: string, version: string) =>
  `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-${version}.tgz`;

describe("#366 resolved direct-root dependency constraints", () => {
  it("refuses a substituted fflate version although root declarations, license and SRI shape still match", () => {
    const { lock, manifest, key, spec } = installedRootEdge("fflate");
    expect(spec).toBe("0.8.3");
    expect(lock.packages[key]?.version).toBe("0.8.3");
    expect(auditLockedPackages366(lock, manifest).status).toBe("VERIFIED_METADATA");

    // Actual recorded SRI/license preserved; only the simulated resolved node
    // version and its plausible registry URL change. Neither file is edited.
    lock.packages[key] = {
      ...lock.packages[key],
      version: "0.8.4",
      resolved: matchingRegistrySource("fflate", "0.8.4"),
    };
    const result = auditLockedPackages366(lock, manifest);
    expect(result.failures).toContain("DIRECT_VERSION_MISMATCH fflate (0.8.3 vs 0.8.4)");
    expect(result.status).toBe("NO_GO");
  });

  it("allows a genuine supported caret range but rejects an incompatible resolved major", () => {
    const { lock, manifest, key, spec } = installedRootEdge("css-tree");
    expect(spec).toBe("^3.2.1");
    expect(lock.packages[key]?.version).toBe("3.2.1");
    expect(auditLockedPackages366(lock, manifest).status).toBe("VERIFIED_METADATA");
    // These are hypothetical pinned metadata variants, not authenticated
    // tarballs or legal clearance.
    lock.packages[key] = {
      ...lock.packages[key],
      version: "3.2.9",
      resolved: matchingRegistrySource("css-tree", "3.2.9"),
    };
    expect(auditLockedPackages366(lock, manifest).status).toBe("VERIFIED_METADATA");
    lock.packages[key] = {
      ...lock.packages[key],
      version: "4.0.0",
      resolved: matchingRegistrySource("css-tree", "4.0.0"),
    };
    expect(auditLockedPackages366(lock, manifest).failures)
      .toContain("DIRECT_VERSION_MISMATCH css-tree (^3.2.1 vs 4.0.0)");
  });

  it("refuses an unsupported root range even when manifest and root lock strings agree", () => {
    const { lock, manifest } = installedRootEdge("fflate");
    lock.packages[""]!.dependencies = { fflate: "file:../fflate" };
    manifest.dependencies.fflate = "file:../fflate";
    const result = auditLockedPackages366(lock, manifest);
    expect(result.failures).toContain("DIRECT_VERSION_MISMATCH fflate (file:../fflate vs 0.8.3)");
    expect(result.status).toBe("NO_GO");
  });

  it("rejects a noncanonical installed package path instead of treating it as the direct root target", () => {
    const { lock, manifest, key } = installedRootEdge("fflate");
    const original = lock.packages[key]!;
    delete lock.packages[key];
    lock.packages["node_modules/other/node_modules/fflate"] = original;
    const result = auditLockedPackages366(lock, manifest);
    expect(result.failures).toContain("MISSING_DIRECT fflate");
    expect(result.status).toBe("NO_GO");
  });
});
