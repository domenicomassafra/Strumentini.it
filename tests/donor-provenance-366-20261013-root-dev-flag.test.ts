import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditLockedPackages366 } from "../scripts/donor-provenance-366";

const manifest = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};
const installedLock = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")) as {
  packages: Record<string, {
    version?: string; license?: string; integrity?: string; resolved?: string;
    dev?: boolean; devOptional?: boolean;
    dependencies?: Record<string, string>;
  }>;
};

function realPinnedDirect() {
  const name = "fflate";
  const spec = manifest.dependencies[name];
  const entry = installedLock.packages[`node_modules/${name}`];
  if (spec !== "0.8.3" || installedLock.packages[""]?.dependencies?.[name] !== spec ||
      entry?.version !== spec || entry.license !== "MIT" || !entry.integrity || !entry.resolved) {
    throw new Error("Expected real pinned production fflate@0.8.3 metadata");
  }
  return {
    lock: {
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { [name]: spec } },
        [`node_modules/${name}`]: {
          version: entry.version, license: entry.license,
          integrity: entry.integrity, resolved: entry.resolved,
        },
      },
    },
    direct: { dependencies: { [name]: spec } },
    path: "node_modules/fflate" as const,
  };
}

describe("#366 root production dependency must not be hidden behind lockfile dev markers", () => {
  it("accepts the unmodified pinned direct dependency", () => {
    const { lock, direct } = realPinnedDirect();
    expect(auditLockedPackages366(lock, direct)).toMatchObject({
      status: "VERIFIED_METADATA", failures: [],
    });
  });

  it.each(["dev", "devOptional"] as const)("refuses a direct production node marked %s", (flag) => {
    const { lock, direct, path } = realPinnedDirect();
    const entry = lock.packages[path]!;
    Object.assign(entry, { [flag]: true });
    const result = auditLockedPackages366(lock, direct);
    expect(result.status).toBe("NO_GO");
    expect(result.failures).toContain(`DEV_ONLY_DIRECT fflate -> ${path}`);
  });

  it("does not approve missing-license and invalid-SRI root dependencies hidden by dev flags", () => {
    for (const [flag, corruption, expected] of [
      ["dev", { license: undefined }, "UNKNOWN_LICENSE"],
      ["devOptional", { integrity: "sha512-bogus" }, "INVALID_SRI"],
    ] as const) {
      const { lock, direct, path } = realPinnedDirect();
      Object.assign(lock.packages[path]!, { [flag]: true, ...corruption });
      const result = auditLockedPackages366(lock, direct);
      expect(result.status).toBe("NO_GO");
      expect(result.failures).toContain(`DEV_ONLY_DIRECT fflate -> ${path}`);

      // Without the forged dev marker the same missing evidence is already
      // correctly refused; the marker must not turn that NO_GO into PASS.
      const unmarked = realPinnedDirect();
      Object.assign(unmarked.lock.packages[unmarked.path]!, corruption);
      const unmarkedResult = auditLockedPackages366(unmarked.lock, unmarked.direct);
      expect(unmarkedResult.status).toBe("NO_GO");
      expect(unmarkedResult.failures).toContain(`${expected} ${path}`);
    }
  });
});
