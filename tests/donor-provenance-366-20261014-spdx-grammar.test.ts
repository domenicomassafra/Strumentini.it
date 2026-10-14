/** #366: malformed SPDX expressions must never inherit legitimate locked
 * licenses merely because their component identifiers are on the allowlist.
 * Inputs below copy original installed package-lock v3 metadata in memory.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditCandidate366, auditLockedPackages366 } from "../scripts/donor-provenance-366";

type Entry = {
  version?: string; license?: string; integrity?: string; resolved?: string;
};
type Lock = { lockfileVersion: 3; packages: Record<string, Entry> };
const installed = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")) as Lock;
const packages = ["fflate", "@img/sharp-wasm32"] as const;

function installedPackageGraph(name: typeof packages[number]) {
  const path = `node_modules/${name}`;
  const original = installed.packages[path];
  if (!original?.version || !original.integrity || !original.resolved || !original.license) {
    throw Error(`#366 missing original installed npm package metadata ${path}`);
  }
  const lock: Lock = {
    lockfileVersion: 3,
    packages: {
      "": { },
      [path]: {
        version: original.version, license: original.license,
        integrity: original.integrity, resolved: original.resolved,
      },
    },
  };
  return { path, lock, original };
}

describe("#366 original npm SPDX expression grammar (no adoption authorization)", () => {
  it("retains real installed valid simple and conjunctive license metadata", () => {
    const mit = installedPackageGraph("fflate");
    const multi = installedPackageGraph("@img/sharp-wasm32");
    expect(mit.original.license).toBe("MIT");
    expect(multi.original.license).toBe("Apache-2.0 AND LGPL-3.0-or-later AND MIT");
    for (const { lock } of [mit, multi]) {
      expect(auditLockedPackages366(lock, {})).toMatchObject({ status: "VERIFIED_METADATA", failures: [] });
    }
    const { lock, path } = mit;
    lock.packages[path]!.license = "(MIT OR Apache-2.0) AND ISC";
    expect(auditLockedPackages366(lock, {}).status).toBe("VERIFIED_METADATA");
  });

  it.each([
    "MIT(", "(MIT", "MIT)", "MIT()", "MIT(Apache-2.0)",
    "MIT OR (Apache-2.0", "MIT AND Apache-2.0)",
  ])("refuses structurally invalid recorded SPDX license: %s", license => {
    const { path, lock } = installedPackageGraph("fflate");
    lock.packages[path]!.license = license;
    const result = auditLockedPackages366(lock, {});
    expect(result.status).toBe("NO_GO");
    expect(result.failures).toContain(`UNKNOWN_LICENSE ${path}`);
    expect(result.rows).toEqual(expect.arrayContaining([expect.objectContaining({ name: "fflate", license })]));
  });

  it("refuses malformed SPDX in a donor candidate without adopting it", () => {
    const { original } = installedPackageGraph("fflate");
    const candidate = { name: "fflate", version: original.version, license: "MIT(Apache-2.0)",
      dist: { integrity: original.integrity, tarball: original.resolved } };
    const report = auditCandidate366(candidate, null);
    expect(report.decision).toBe("NO_ADOPT");
    expect(report.failures).toContain(`UNKNOWN_LICENSE fflate@${original.version}`);
  });
});
