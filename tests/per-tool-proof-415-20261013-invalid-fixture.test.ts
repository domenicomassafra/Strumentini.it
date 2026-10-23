/** #415: byte-hash agreement is not current proof if the indexed JSON oracle
 * vectors cannot be parsed by the actual supported fixture consumer.
 */
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { probeReceipt415, readCurrentFixtureHashes415 } from "../scripts/audit-per-tool-proof-415";
import { currentEvidenceSourceFingerprint, currentRevision } from "../scripts/lib/current-revision";

const sha256 = (value: Uint8Array | string): string => createHash("sha256").update(value).digest("hex");

describe("#415 indexed fixture content must remain consumable current JSON", () => {
  it("preserves all current version-controlled indexed family files as valid source evidence", async () => {
    const checkout = resolve(import.meta.dirname, "..");
    const index = JSON.parse(await readFile(resolve(checkout, "quality/fixtures/index.json"), "utf8")) as {
      families: { id: string; path: string; format: string }[];
    };
    expect(index.families).toHaveLength(100);
    expect(index.families.every(row => row.format === "json")).toBe(true);
    const hashes = await readCurrentFixtureHashes415(checkout, index.families.map(row => row.id), index.families);
    expect(hashes?.size).toBe(index.families.length);
    for (const row of index.families) {
      const physical = await readFile(resolve(checkout, row.path));
      expect(hashes?.get(row.id), row.id).toBe(sha256(physical));
    }
  }, 20_000);

  it("refuses a genuinely changed malformed fixture even when a matching receipt hashes its exact new bytes", async () => {
    const checkout = resolve(import.meta.dirname, "..");
    const family = "business-days";
    const relativePath = "quality/fixtures/business-days/vectors.json";
    const fixture = await readFile(resolve(checkout, relativePath));
    expect(JSON.parse(fixture.toString("utf8"))).toHaveProperty("vectors");
    const tool = catalog.find(row => row.id === "business-day")!;
    const [manifest, registry, revision, fingerprint] = await Promise.all([
      readFile(resolve(checkout, "src/tools/business-day/manifest.ts")),
      readFile(resolve(checkout, "quality/oracles/registry.json")),
      currentRevision(checkout),
      currentEvidenceSourceFingerprint(checkout),
    ]);
    const root = await mkdtemp(join(tmpdir(), "proof-415-malformed-vectors-"));
    try {
      const fullPath = join(root, relativePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, fixture);
      const indexed = [{ id: family, path: relativePath }];
      const original = await readCurrentFixtureHashes415(root, [family], indexed);
      expect(original?.get(family)).toBe(sha256(fixture));
      const receipt = (fixtureHash: string): string => JSON.stringify({
        toolId: tool.id, schemaVersion: 1, status: "GOLD", goldEligible: true,
        revision, sourceFingerprint: fingerprint, runtime: tool.runtime,
        oracleEntryId: tool.gold.oracleEntryId, fixtureFamilies: tool.gold.fixtureFamilies,
        identities: {
          manifestSha256: sha256(manifest),
          oracleRegistrySha256: sha256(registry),
          [`fixture:${family}:sha256`]: fixtureHash,
        },
      });
      const currentProbe = (content: string, currentFixtureSha256ByFamily: ReadonlyMap<string, string>) => ({
        toolId: tool.id, path: `quality/receipts/${tool.id}.gold.json`,
        content, expectedSha256: sha256(content), revision, fingerprint,
        currentManifestSha256: sha256(manifest), currentOracleRegistrySha256: sha256(registry),
        currentFixtureSha256ByFamily,
      });
      expect(probeReceipt415(currentProbe(receipt(original!.get(family)!), original!))).toBe(true);

      // Same file path, distinct physical bytes. A new receipt could be
      // internally SHA-valid despite the vectors being unparseable.
      const invalid = Buffer.from('{"schema_version":1,"vectors":[{"expected":', "utf8");
      expect(() => JSON.parse(invalid.toString("utf8"))).toThrow();
      await writeFile(fullPath, invalid);
      const withdrawn = await readCurrentFixtureHashes415(root, [family], indexed);
      if (withdrawn !== null) {
        // A hash-only implementation incorrectly treats impossible fixtures
        // as a source-current Gold certificate.
        expect(probeReceipt415(currentProbe(receipt(sha256(invalid)), withdrawn))).toBe(false);
      }
      expect(withdrawn).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);
});
