/** #415: a current per-tool Gold probe must identify the current oracle registry bytes. */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { probeReceipt415, readCurrentFixtureHashes415 } from "../scripts/audit-per-tool-proof-415";
import { currentEvidenceSourceFingerprint, currentRevision } from "../scripts/lib/current-revision";

const sha256 = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");

describe("#415 current oracle-registry source binding", () => {
  it("rejects a SHA-valid source-current receipt that claims a withdrawn oracle registry", async () => {
    const root = resolve(import.meta.dirname, "..");
    const tool = catalog.find((entry) => entry.id === "business-day")!;
    const fixtureIndex = JSON.parse(await readFile(resolve(root, "quality/fixtures/index.json"), "utf8")) as {
      families: { id: string; path: string }[];
    };
    const fixtureHashes = await readCurrentFixtureHashes415(root, tool.gold.fixtureFamilies, fixtureIndex.families);
    expect(fixtureHashes).not.toBeNull();

    const [manifest, registry, fingerprint, revision] = await Promise.all([
      readFile(resolve(root, `src/tools/${tool.id}/manifest.ts`)),
      readFile(resolve(root, "quality/oracles/registry.json")),
      currentEvidenceSourceFingerprint(root),
      currentRevision(root),
    ]);
    const currentOracleHash = sha256(registry);
    const temp = await mkdtemp(join(tmpdir(), "proof-415-oracle-registry-"));
    try {
      // A genuinely different oracle source file, not an invented hex digest.
      const withdrawn = JSON.parse(registry.toString("utf8")) as {
        entries: { id: string; expected_output_strategy: string }[];
      };
      const oracle = withdrawn.entries.find((entry) => entry.id === tool.gold.oracleEntryId)!;
      oracle.expected_output_strategy = "WITHDRAWN: unchecked manual expectation";
      const oldPath = join(temp, "oracle-registry-previous.json");
      await writeFile(oldPath, JSON.stringify(withdrawn, null, 2) + "\n");
      const withdrawnOracleHash = sha256(await readFile(oldPath));
      expect(withdrawnOracleHash).not.toBe(currentOracleHash);

      const currentIdentities = {
        manifestSha256: sha256(manifest),
        ...Object.fromEntries([...fixtureHashes!].map(([id, digest]) => [`fixture:${id}:sha256`, digest])),
        oracleRegistrySha256: currentOracleHash,
      };
      const makeProbe = (identities: Record<string, string>) => {
        const content = JSON.stringify({
          toolId: tool.id, status: "GOLD", schemaVersion: 1, goldEligible: true,
          revision, sourceFingerprint: fingerprint, runtime: tool.runtime,
          oracleEntryId: tool.gold.oracleEntryId, fixtureFamilies: tool.gold.fixtureFamilies,
          identities,
        });
        return {
          toolId: tool.id, path: `quality/receipts/${tool.id}.gold.json`, content,
          expectedSha256: sha256(content), fingerprint, revision,
          currentManifestSha256: sha256(manifest),
          currentFixtureSha256ByFamily: fixtureHashes!,
          currentOracleRegistrySha256: currentOracleHash,
        };
      };

      expect(probeReceipt415(makeProbe(currentIdentities))).toBe(true);
      // All other proof fields and the receipt SHA remain current/valid.
      expect(probeReceipt415(makeProbe({ ...currentIdentities, oracleRegistrySha256: withdrawnOracleHash }))).toBe(false);
      const { oracleRegistrySha256: _missing, ...withoutOracleIdentity } = currentIdentities;
      expect(probeReceipt415(makeProbe(withoutOracleIdentity))).toBe(false);
      expect(probeReceipt415({ ...makeProbe(currentIdentities), currentOracleRegistrySha256: "f".repeat(64) })).toBe(false);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }, 20_000);
});
