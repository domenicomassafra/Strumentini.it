/** #415: only boolean true may affirm Gold eligibility in current source-bound proof. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { probeReceipt415, readCurrentFixtureHashes415 } from "../scripts/audit-per-tool-proof-415";
import { currentEvidenceSourceFingerprint, currentRevision } from "../scripts/lib/current-revision";
import { buildGoldQualityIndex, buildSourceBoundGoldQualityIndex } from "../src/onboarding/quality";
import { validateGoldReceipts, type ToolCertificationReceipt } from "../src/release/validation";
import { catalog } from "../src/generated/catalog";

const root = resolve(import.meta.dirname, "..");
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const tool = catalog.find((entry) => entry.id === "business-day")!;
const path = "quality/receipts/business-day.gold.json";
const invalidValues: readonly unknown[] = [false, null, "false", "true", 0, 1, [], {}];

let fingerprint: string;
let revision: string;
let manifestSha256: string;
let registrySha256: string;
let fixtureHashes: ReadonlyMap<string, string>;

/** Manufacture only a synthetic receipt; every source identity is from actual files. */
function receiptFor(eligibility: unknown, supplied = true) {
  const body: Record<string, unknown> = {
    toolId: tool.id, schemaVersion: 1, status: "GOLD",
    revision, sourceFingerprint: fingerprint, runtime: tool.runtime,
    oracleEntryId: tool.gold.oracleEntryId, fixtureFamilies: tool.gold.fixtureFamilies,
    identities: {
      manifestSha256,
      oracleRegistrySha256: registrySha256,
      ...Object.fromEntries([...fixtureHashes].map(([family, digest]) => [`fixture:${family}:sha256`, digest])),
    },
  };
  if (supplied) body.goldEligible = eligibility;
  const content = JSON.stringify(body);
  // Read back JSON semantics exactly as a disk receipt would be parsed.
  const parsed = JSON.parse(content) as Record<string, unknown>;
  return {
    content,
    probe: {
      toolId: tool.id, path, content, expectedSha256: sha256(content),
      fingerprint, revision, currentManifestSha256: manifestSha256,
      currentFixtureSha256ByFamily: fixtureHashes,
      currentOracleRegistrySha256: registrySha256,
    },
    raw: { ...parsed, receiptPath: path, receiptSha256: sha256(content) },
  };
}

describe("#415 Gold eligibility must be a strict boolean when supplied", () => {
  beforeAll(async () => {
    expect(tool.gold.oracleEntryId).toBe("cand-083");
    const [manifest, page, registry, fixtureIndex, sourceFingerprint, current] = await Promise.all([
      readFile(resolve(root, `src/tools/${tool.id}/manifest.ts`)),
      readFile(resolve(root, `src/pages/tools/${tool.id}.astro`)),
      readFile(resolve(root, "quality/oracles/registry.json")),
      readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
      currentEvidenceSourceFingerprint(root), currentRevision(root),
    ]);
    expect(page.length).toBeGreaterThan(0);
    const oracle = JSON.parse(registry.toString("utf8")) as { entries: { id: string }[] };
    expect(oracle.entries.some((entry) => entry.id === tool.gold.oracleEntryId)).toBe(true);
    const index = JSON.parse(fixtureIndex) as { families: { id: string; path: string }[] };
    const hashes = await readCurrentFixtureHashes415(root, tool.gold.fixtureFamilies, index.families);
    expect(hashes).not.toBeNull();
    fixtureHashes = hashes!;
    manifestSha256 = sha256(manifest);
    registrySha256 = sha256(registry);
    fingerprint = sourceFingerprint;
    revision = current;
  });

  it("refuses malformed eligibility in the current #415 hashed receipt probe", () => {
    expect(probeReceipt415(receiptFor(true).probe)).toBe(true);
    // Optional schema-v1 field omitted by legacy receipts is still compatible.
    expect(probeReceipt415(receiptFor(undefined, false).probe)).toBe(true);
    for (const value of invalidValues) {
      expect(probeReceipt415(receiptFor(value).probe), `supplied ${JSON.stringify(value)}`).toBe(false);
    }
  });

  it("refuses malformed eligibility in the public Gold index and historical projection", () => {
    expect(buildSourceBoundGoldQualityIndex([receiptFor(true).raw], [tool.id], fingerprint).index.tools).toHaveLength(1);
    expect(buildSourceBoundGoldQualityIndex([receiptFor(undefined, false).raw], [tool.id], fingerprint).index.tools).toHaveLength(1);
    for (const value of invalidValues) {
      const raw = receiptFor(value).raw;
      expect(buildSourceBoundGoldQualityIndex([raw], [tool.id], fingerprint).index.tools,
        `public supplied ${JSON.stringify(value)}`).toEqual([]);
      expect(buildGoldQualityIndex([raw], [tool.id]).index.tools,
        `historical supplied ${JSON.stringify(value)}`).toEqual([]);
    }
    // An own property with undefined is supplied, unlike a genuinely absent legacy field.
    expect(buildSourceBoundGoldQualityIndex([{ ...receiptFor(true).raw, goldEligible: undefined }],
      [tool.id], fingerprint).index.tools).toEqual([]);
  });

  it("refuses malformed eligibility at the release validator, including own undefined", () => {
    const entry = [{ id: tool.id, route: tool.route }];
    const release = (raw: Record<string, unknown>) => validateGoldReceipts(
      entry, [raw as unknown as ToolCertificationReceipt], revision, fingerprint,
    );
    expect(release(receiptFor(true).raw)).toEqual([]);
    expect(release(receiptFor(undefined, false).raw)).toEqual([]);
    for (const value of invalidValues) {
      expect(release(receiptFor(value).raw).map((finding) => finding.code),
        `release supplied ${JSON.stringify(value)}`).toContain("GOLD_RECEIPT_NOT_GOLD");
    }
    expect(release({ ...receiptFor(true).raw, goldEligible: undefined }).map((finding) => finding.code))
      .toContain("GOLD_RECEIPT_NOT_GOLD");
  });
});
