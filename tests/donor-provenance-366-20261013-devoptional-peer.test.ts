/** #366: npm v3 devOptional can mean a valid present OPTIONAL runtime peer.
 * Authentic Vite lock metadata; all mutations are hermetic in-memory fixtures.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditLockedPackages366 } from "../scripts/donor-provenance-366";

type Entry = {
  version?: string; license?: string; integrity?: string; resolved?: string;
  dev?: boolean; devOptional?: boolean;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};
type Lock = { lockfileVersion: number; packages: Record<string, Entry> };

const source = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")) as Lock;
const vitePath = "node_modules/vite";
const peers = ["@types/node", "tsx", "yaml"] as const;
function graph() {
  const vite = structuredClone(source.packages[vitePath]);
  if (vite?.version !== "8.3.0" || !vite.license || !vite.integrity || !vite.resolved) {
    throw new Error("Expected actual pinned Vite@8.3.0 package metadata");
  }
  // Isolate the real Vite optional peer contract from unrelated transitive
  // packages; retain all actual peer ranges and peerDependenciesMeta flags.
  vite.dependencies = {};
  const lock: Lock = {
    lockfileVersion: 3,
    packages: {
      "": { dependencies: { vite: vite.version } },
      [vitePath]: vite,
    },
  };
  for (const name of peers) {
    const from = source.packages["node_modules/" + name];
    // An independently installed production donor can promote a previously
    // devOptional peer (for example @types/node used by docx) to production.
    // Reconstruct the Vite-only optional graph without depending on npm hoisting.
    if (!from?.version || !from.license || !from.integrity || !from.resolved ||
      from.dev === true ||
      vite.peerDependenciesMeta?.[name]?.optional !== true || !vite.peerDependencies?.[name]) {
      throw new Error("Expected actual compatible optional Vite peer: " + name);
    }
    lock.packages["node_modules/" + name] = {
      version: from.version, license: from.license, integrity: from.integrity,
      resolved: from.resolved, devOptional: true,
    };
  }
  return { lock, manifest: { dependencies: { vite: vite.version } } };
}

describe("#366 actual npm devOptional + Vite optional peer semantics", () => {
  it("accepts version-compatible, properly attributed present optional peers", () => {
    const { lock, manifest } = graph();
    const result = auditLockedPackages366(lock, manifest);
    expect(result).toMatchObject({ status: "VERIFIED_METADATA", failures: [] });
  });

  it("permits those OPTIONAL peers to be absent, as declared by Vite", () => {
    const { lock, manifest } = graph();
    for (const peer of peers) delete lock.packages["node_modules/" + peer];
    expect(auditLockedPackages366(lock, manifest))
      .toMatchObject({ status: "VERIFIED_METADATA", failures: [] });
  });

  it.each(["@types/node", "tsx", "yaml"] as const)(
    "still refuses an incompatible installed devOptional peer: %s",
    name => {
      const { lock, manifest } = graph();
      const path = "node_modules/" + name;
      lock.packages[path]!.version = "1.0.0";
      lock.packages[path]!.resolved =
        `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-1.0.0.tgz`;
      const audit = auditLockedPackages366(lock, manifest);
      expect(audit.status).toBe("NO_GO");
      expect(audit.failures).toEqual(expect.arrayContaining([
        expect.stringContaining("OPTIONAL_PEER_VERSION_MISMATCH " + vitePath + " -> " + path),
      ]));
    },
  );

  it.each(["license", "integrity", "resolved"] as const)(
    "checks installed optional devOptional peer %s provenance before metadata approval",
    field => {
      const { lock, manifest } = graph();
      const peer = lock.packages["node_modules/tsx"]!;
      if (field === "license") peer.license = "NOASSERTION";
      if (field === "integrity") peer.integrity = "sha512-invalid";
      if (field === "resolved") peer.resolved = "https://untrusted.example/tsx-4.23.15.tgz";
      const audit = auditLockedPackages366(lock, manifest);
      expect(audit.status).toBe("NO_GO");
      expect(audit.failures).toContain({
        license: "UNKNOWN_LICENSE node_modules/tsx",
        integrity: "INVALID_SRI node_modules/tsx",
        resolved: "UNVERIFIED_SOURCE node_modules/tsx",
      }[field]);
    },
  );

  it("audits a present required devOptional peer and rejects it when absent", () => {
    const { lock, manifest } = graph();
    delete lock.packages[vitePath]!.peerDependenciesMeta!.tsx;
    const audit = auditLockedPackages366(lock, manifest);
    expect(audit).toMatchObject({ status: "VERIFIED_METADATA", failures: [] });
    delete lock.packages["node_modules/tsx"];
    expect(auditLockedPackages366(lock, manifest).failures)
      .toContain("MISSING_PEER node_modules/vite -> tsx");
  });

  it("retains refusal for a truly dev-only optional peer", () => {
    const { lock, manifest } = graph();
    const peer = lock.packages["node_modules/tsx"]!;
    delete peer.devOptional;
    peer.dev = true;
    const audit = auditLockedPackages366(lock, manifest);
    expect(audit.status).toBe("NO_GO");
    expect(audit.failures).toContain("DEV_ONLY_PEER node_modules/vite -> node_modules/tsx");
  });

  it("removes genuine devOptional metadata false positives without claiming rights", () => {
    const manifest = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
      dependencies: Record<string, string>; devDependencies: Record<string, string>;
    };
    const audit = auditLockedPackages366(source, manifest);
    expect(audit.status).toBe("VERIFIED_METADATA");
    expect(audit.failures.some(failure => failure.startsWith("DEV_ONLY_PEER node_modules/vite -> ")))
      .toBe(false);
    expect(audit.failures.some(failure => failure.startsWith("DEV_ONLY_TRANSITIVE ")))
      .toBe(false);
  });
});
