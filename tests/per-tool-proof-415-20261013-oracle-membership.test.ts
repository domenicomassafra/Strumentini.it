/** #415: source-current receipt SHA does not confer proof after oracle withdrawal. */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { createProofMap415, probeReceipt415, readCurrentFixtureHashes415 } from "../scripts/audit-per-tool-proof-415";
import { currentEvidenceSourceFingerprint, currentRevision } from "../scripts/lib/current-revision";

const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

describe("#415 current proof must require oracle-entry membership", () => {
  it("does not project VERIFIED when a source-current business-day oracle is withdrawn from the actual registry", async () => {
    const root = resolve(import.meta.dirname, "..");
    const tool = catalog.find(row => row.id === "business-day")!;
    expect(tool.gold.oracleEntryId).toBe("cand-083");
    const [registryBytes, indexBytes, manifestBytes, revision, fingerprint] = await Promise.all([
      readFile(resolve(root, "quality/oracles/registry.json")),
      readFile(resolve(root, "quality/fixtures/index.json")),
      readFile(resolve(root, "src/tools/business-day/manifest.ts")),
      currentRevision(root), currentEvidenceSourceFingerprint(root),
    ]);
    const registry = JSON.parse(registryBytes.toString("utf8")) as { entries: { id: string }[] };
    const fixtureIndex = JSON.parse(indexBytes.toString("utf8")) as { families: { id: string; path: string }[] };
    const registryIds = new Set(registry.entries.map(entry => entry.id));
    const fixtureIds = new Set(fixtureIndex.families.map(family => family.id));
    expect(registryIds.has(tool.gold.oracleEntryId)).toBe(true);
    const fixtureHashes = await readCurrentFixtureHashes415(root, tool.gold.fixtureFamilies, fixtureIndex.families);
    expect(fixtureHashes).not.toBeNull();
    const path = `quality/receipts/${tool.id}.gold.json`;
    const content = JSON.stringify({
      toolId: tool.id, status: "GOLD", schemaVersion: 1, goldEligible: true,
      revision, sourceFingerprint: fingerprint, runtime: tool.runtime,
      oracleEntryId: tool.gold.oracleEntryId, fixtureFamilies: tool.gold.fixtureFamilies,
      identities: {
        manifestSha256: sha256(manifestBytes),
        oracleRegistrySha256: sha256(registryBytes),
        ...Object.fromEntries([...fixtureHashes!].map(([id, hash]) => [`fixture:${id}:sha256`, hash])),
      },
    });
    // The exact live bytes and hashes pass the existing receipt probe; it does
    // not independently check whether the claimed oracle ID still exists.
    expect(probeReceipt415({
      toolId: tool.id, path, content, expectedSha256: sha256(content),
      fingerprint, revision, currentManifestSha256: sha256(manifestBytes),
      currentOracleRegistrySha256: sha256(registryBytes),
      currentFixtureSha256ByFamily: fixtureHashes!,
    })).toBe(true);

    const candidates = new Map([[tool.id, { path }]]);
    const source = new Map([[tool.id, { manifestPresent: true, pagePresent: true, historicalHashMatches: true }]]);
    const registered = createProofMap415([tool], new Map(), candidates, source, registryIds, fixtureIds);
    expect(registered.entries[0]).toMatchObject({ registryBinding: "REGISTERED", currentProof: "VERIFIED", currentReceipt: path });

    // Source truth is the real 269-entry registry. Model withdrawing its
    // actual cand-083 entry while keeping the otherwise valid candidate.
    const withdrawnIds = new Set(registry.entries.filter(entry => entry.id !== tool.gold.oracleEntryId).map(entry => entry.id));
    expect(withdrawnIds.size).toBe(registryIds.size - 1);
    const withdrawnRoot = await mkdtemp(join(tmpdir(), "proof-415-withdrawn-oracle-"));
    try {
      const withdrawnPath = join(withdrawnRoot, "registry.json");
      await writeFile(withdrawnPath, JSON.stringify({ ...registry, entries: registry.entries.filter(entry => entry.id !== tool.gold.oracleEntryId) }, null, 2) + "\n");
      const withdrawnRegistryBytes = await readFile(withdrawnPath);
      const withdrawnRegistry = JSON.parse(withdrawnRegistryBytes.toString("utf8")) as { entries: { id: string }[] };
      expect(new Set(withdrawnRegistry.entries.map(entry => entry.id))).toEqual(withdrawnIds);
      // Recompute both identities from actual withdrawn-registry and receipt
      // bytes; a registry digest match alone still does not prove membership.
      const withdrawnContent = JSON.stringify({
        ...JSON.parse(content),
        identities: { ...JSON.parse(content).identities, oracleRegistrySha256: sha256(withdrawnRegistryBytes) },
      });
      expect(probeReceipt415({
        toolId: tool.id, path, content: withdrawnContent, expectedSha256: sha256(withdrawnContent),
        fingerprint, revision, currentManifestSha256: sha256(manifestBytes),
        currentOracleRegistrySha256: sha256(withdrawnRegistryBytes),
        currentFixtureSha256ByFamily: fixtureHashes!,
      })).toBe(true);
    } finally {
      await rm(withdrawnRoot, { recursive: true, force: true });
    }
    const withdrawn = createProofMap415([tool], new Map(), candidates, source, withdrawnIds, fixtureIds);
    expect(withdrawn.entries[0]).toMatchObject({
      registryBinding: "PENDING_REGISTRY_OR_FIXTURE", currentProof: "PENDING", currentReceipt: null,
    });
    expect(withdrawn.summary).toMatchObject({ verified: 0, pending: 1, registryBindingsPending: 1 });
  }, 20_000);
});
