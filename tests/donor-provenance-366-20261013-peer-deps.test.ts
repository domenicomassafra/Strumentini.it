/** #366: declared runtime peer edges are dependencies for provenance purposes. */
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

const actualLock = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")) as Lock;
const parentName = "preact-render-to-string";
const peerName = "preact";
const parentPath = "node_modules/preact-render-to-string";
const peerPath = "node_modules/preact";
const peerRange = ">=10 || >= 11.0.0-0";

/** Keep authentic lock version/license/registry/SRI in every isolated specimen. */
function pinned(name: string): Entry {
  const entry = actualLock.packages["node_modules/" + name];
  if (!entry?.version || !entry.license || !entry.integrity || !entry.resolved) {
    throw new Error("Missing actual pinned npm metadata for " + name);
  }
  return structuredClone(entry);
}

function caseGraph(options: { optional?: boolean; nested?: boolean } = {}) {
  const parent = pinned(parentName);
  const peer = pinned(peerName);
  const rootDep = { [parentName]: parent.version! };
  if (parent.version !== "6.7.0" || peer.version !== "10.29.8" ||
    parent.peerDependencies?.[peerName] !== peerRange || parent.license !== "MIT" || peer.license !== "MIT") {
    throw new Error("Real preact-render-to-string / preact lock metadata changed");
  }
  if (options.optional) parent.peerDependenciesMeta = { [peerName]: { optional: true } };
  // Root dependency and nested placement are modified only in memory.
  const parentKey = options.nested ? "node_modules/fflate/node_modules/preact-render-to-string" : parentPath;
  const manifest = options.nested
    ? { dependencies: { fflate: "0.8.3" } }
    : { dependencies: rootDep };
  const lock: Lock = { lockfileVersion: 3, packages: {
    "": { dependencies: { ...manifest.dependencies } },
    [parentKey]: parent,
    [peerPath]: peer,
  } };
  if (options.nested) lock.packages["node_modules/fflate"] = pinned("fflate");
  return { lock, manifest, parentKey, peerPath, peer };
}

function incompatible(entry: Entry): Entry {
  return { ...entry, version: "1.0.0", resolved: "https://registry.npmjs.org/preact/-/preact-1.0.0.tgz" };
}

describe("#366 read-only runtime peer dependency provenance on authentic npm lock metadata", () => {
  it("accepts the actual compatible required peer with intact metadata", () => {
    const { lock, manifest } = caseGraph();
    expect(auditLockedPackages366(lock, manifest)).toMatchObject({
      status: "VERIFIED_METADATA", failures: [],
    });
  });

  it("refuses a missing required peer even if the parent's package and SRI are valid", () => {
    const { lock, manifest } = caseGraph();
    delete lock.packages[peerPath];
    const outcome = auditLockedPackages366(lock, manifest);
    expect(outcome.status).toBe("NO_GO");
    expect(outcome.failures).toContain("MISSING_PEER node_modules/preact-render-to-string -> preact");
  });

  it("refuses a present required peer with an incompatible semver but plausible registry URL", () => {
    const { lock, manifest, peer } = caseGraph();
    lock.packages[peerPath] = incompatible(peer);
    const outcome = auditLockedPackages366(lock, manifest);
    expect(outcome.status).toBe("NO_GO");
    expect(outcome.failures).toContain(
      "PEER_VERSION_MISMATCH node_modules/preact-render-to-string -> node_modules/preact (>=10 || >= 11.0.0-0 vs 1.0.0)",
    );
  });

  it.each(["dev", "devOptional"] as const)("refuses a required peer hidden by the %s lock marker", flag => {
    const { lock, manifest } = caseGraph();
    lock.packages[peerPath]![flag] = true;
    const outcome = auditLockedPackages366(lock, manifest);
    expect(outcome.status).toBe("NO_GO");
    expect(outcome.failures).toContain(
      "DEV_ONLY_PEER node_modules/preact-render-to-string -> node_modules/preact",
    );
  });

  it("allows an absent explicitly optional peer but checks a present compatible one", () => {
    const { lock, manifest } = caseGraph({ optional: true });
    expect(auditLockedPackages366(lock, manifest)).toMatchObject({
      status: "VERIFIED_METADATA", failures: [],
    });
    delete lock.packages[peerPath];
    expect(auditLockedPackages366(lock, manifest)).toMatchObject({
      status: "VERIFIED_METADATA", failures: [],
    });
  });

  it("refuses a present optional peer with an incompatible version or unsupported range", () => {
    const { lock, manifest, peer } = caseGraph({ optional: true });
    lock.packages[peerPath] = incompatible(peer);
    expect(auditLockedPackages366(lock, manifest).failures).toContain(
      "OPTIONAL_PEER_VERSION_MISMATCH node_modules/preact-render-to-string -> node_modules/preact (>=10 || >= 11.0.0-0 vs 1.0.0)",
    );
    lock.packages[peerPath] = peer;
    lock.packages[parentPath]!.peerDependencies = { preact: "^99.0.0 ||" };
    expect(auditLockedPackages366(lock, manifest).failures).toContain(
      "OPTIONAL_PEER_VERSION_MISMATCH node_modules/preact-render-to-string -> node_modules/preact (^99.0.0 || vs 10.29.8)",
    );
  });

  it("requires valid license and SHA512-SRI for an installed optional peer", () => {
    const { lock, manifest } = caseGraph({ optional: true });
    delete lock.packages[peerPath]!.license;
    lock.packages[peerPath]!.integrity = "sha512-invalid";
    const outcome = auditLockedPackages366(lock, manifest);
    expect(outcome.status).toBe("NO_GO");
    expect(outcome.failures).toContain("UNKNOWN_LICENSE node_modules/preact");
    expect(outcome.failures).toContain("INVALID_SRI node_modules/preact");
  });

  it.each(["dev", "devOptional"] as const)("refuses a present optional peer marked %s", flag => {
    const { lock, manifest } = caseGraph({ optional: true });
    lock.packages[peerPath]![flag] = true;
    expect(auditLockedPackages366(lock, manifest).failures).toContain(
      "DEV_ONLY_PEER node_modules/preact-render-to-string -> node_modules/preact",
    );
  });

  it("resolves the closest ancestor sibling peer, not an incompatible top-level peer", () => {
    const { lock, manifest, parentKey, peer } = caseGraph({ nested: true });
    const sibling = "node_modules/fflate/node_modules/preact";
    lock.packages[peerPath] = incompatible(peer);
    lock.packages[sibling] = peer;
    const compatible = auditLockedPackages366(lock, manifest);
    expect(compatible.status).toBe("VERIFIED_METADATA");
    lock.packages[sibling] = incompatible(peer);
    const incompatibleSibling = auditLockedPackages366(lock, manifest);
    expect(incompatibleSibling.failures).toContain(
      "PEER_VERSION_MISMATCH " + parentKey + " -> " + sibling + " (>=10 || >= 11.0.0-0 vs 1.0.0)",
    );
  });

  it("does not resolve a required peer from inside the consumer's own node_modules", () => {
    const { lock, manifest, peer } = caseGraph();
    delete lock.packages[peerPath];
    lock.packages[parentPath + "/node_modules/preact"] = peer;
    expect(auditLockedPackages366(lock, manifest).failures).toContain(
      "MISSING_PEER node_modules/preact-render-to-string -> preact",
    );
  });

  it("resolves a scoped package peer only at valid npm ancestor boundaries", () => {
    const pluginName = "@astrojs/preact";
    const pluginPath = "node_modules/@astrojs/preact";
    const plugin = pinned(pluginName);
    if (plugin.peerDependencies?.preact !== "^10.6.5" || plugin.version !== "6.0.5") {
      throw new Error("Expected real scoped Astro/Preact peer dependency metadata");
    }
    // Isolate the actual peer declaration without dragging every unrelated
    // transitive production dependency into this focused fixture.
    plugin.dependencies = {};
    const manifest = { dependencies: { [pluginName]: plugin.version! } };
    const lock: Lock = { lockfileVersion: 3, packages: {
      "": { dependencies: { ...manifest.dependencies } },
      [pluginPath]: plugin,
      [peerPath]: pinned("preact"),
      // This is *inside* the scoped consumer, never a valid supplier of its peer.
      [pluginPath + "/node_modules/preact"]: incompatible(pinned("preact")),
    } };
    expect(auditLockedPackages366(lock, manifest).status).toBe("VERIFIED_METADATA");
    delete lock.packages[peerPath];
    expect(auditLockedPackages366(lock, manifest).failures).toContain(
      "MISSING_PEER " + pluginPath + " -> preact",
    );
  });
});
