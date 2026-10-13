/** #415: a current receipt must not verify a tool whose current route page is absent.
 * Real catalog/oracle/fixture/manifest bytes; synthetic Gold candidate only in memory.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { createProofMap415, probeReceipt415, readCurrentFixtureHashes415 } from "../scripts/audit-per-tool-proof-415";
import { currentEvidenceSourceFingerprint, currentRevision } from "../scripts/lib/current-revision";

const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const root = resolve(import.meta.dirname, "..");

describe("#415 current-proof admission requires live route source", () => {
  it("does not expose VERIFIED for a missing current page or manifest despite authentic registry/fixture/source identities", async () => {
    const tool = catalog.find(entry => entry.id === "business-day")!;
    expect(tool.gold.oracleEntryId).toBe("cand-083");
    const [manifestBytes, pageBytes, registryBytes, fixtureIndexBytes, fingerprint, revision] = await Promise.all([
      readFile(resolve(root, "src/tools/business-day/manifest.ts")),
      readFile(resolve(root, "src/pages/tools/business-day.astro")),
      readFile(resolve(root, "quality/oracles/registry.json")),
      readFile(resolve(root, "quality/fixtures/index.json")),
      currentEvidenceSourceFingerprint(root),
      currentRevision(root),
    ]);
    expect(pageBytes.length).toBeGreaterThan(0);
    const registry = JSON.parse(registryBytes.toString("utf8")) as { entries: { id: string }[] };
    const fixtureIndex = JSON.parse(fixtureIndexBytes.toString("utf8")) as { families: { id: string; path: string }[] };
    const registeredOracleIds = new Set(registry.entries.map(entry => entry.id));
    const registeredFixtureIds = new Set(fixtureIndex.families.map(family => family.id));
    expect(registeredOracleIds.has(tool.gold.oracleEntryId)).toBe(true);
    const familyHashes = await readCurrentFixtureHashes415(root, tool.gold.fixtureFamilies, fixtureIndex.families);
    expect(familyHashes).not.toBeNull();

    const path = `quality/receipts/${tool.id}.gold.json`;
    const content = JSON.stringify({
      toolId: tool.id, schemaVersion: 1, status: "GOLD", goldEligible: true,
      revision, sourceFingerprint: fingerprint, runtime: tool.runtime,
      oracleEntryId: tool.gold.oracleEntryId, fixtureFamilies: tool.gold.fixtureFamilies,
      identities: {
        manifestSha256: sha256(manifestBytes),
        oracleRegistrySha256: sha256(registryBytes),
        ...Object.fromEntries([...familyHashes!].map(([id, digest]) => [`fixture:${id}:sha256`, digest])),
      },
    });
    expect(probeReceipt415({
      toolId: tool.id, path, content, expectedSha256: sha256(content),
      revision, fingerprint, currentManifestSha256: sha256(manifestBytes),
      currentFixtureSha256ByFamily: familyHashes!,
      currentOracleRegistrySha256: sha256(registryBytes),
    })).toBe(true);

    const candidates = new Map([[tool.id, { path }]]);
    const source = (manifestPresent: boolean, pagePresent: boolean) => new Map([
      [tool.id, { manifestPresent, pagePresent, historicalHashMatches: false }],
    ]);
    const map = (manifestPresent: boolean, pagePresent: boolean) =>
      createProofMap415([tool], new Map(), candidates, source(manifestPresent, pagePresent),
        registeredOracleIds, registeredFixtureIds);

    // A valid receipt and registered oracle do not make a missing route real.
    const missingPage = map(true, false);
    expect(missingPage.summary).toMatchObject({ sourceErrors: 1, verified: 0, pending: 1 });
    expect(missingPage.entries[0]).toMatchObject({
      registryBinding: "REGISTERED", currentProof: "PENDING", currentReceipt: null,
      source: { manifestPresent: true, pagePresent: false },
    });

    const missingManifest = map(false, true);
    expect(missingManifest.summary).toMatchObject({ sourceErrors: 1, verified: 0, pending: 1 });
    expect(missingManifest.entries[0]).toMatchObject({
      currentProof: "PENDING", currentReceipt: null,
      source: { manifestPresent: false, pagePresent: true },
    });

    const complete = map(true, true);
    expect(complete.summary).toMatchObject({ sourceErrors: 0, verified: 1, pending: 0 });
    expect(complete.entries[0]).toMatchObject({
      registryBinding: "REGISTERED", currentProof: "VERIFIED", currentReceipt: path,
      source: { manifestPresent: true, pagePresent: true },
    });
  }, 20_000);
});
