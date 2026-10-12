import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { probeReceipt415, readCurrentFixtureHashes415 } from "../scripts/audit-per-tool-proof-415";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const revision = "b".repeat(40);
const fingerprint = "a".repeat(64);
const currentManifestSha256 = sha256('export default { id: "business-day", jobs: ["current"], runtime: { location: "LOCAL" } };');
const sourceFamily = "business-days";
const withdrawnFixture = JSON.stringify({ vectors: [{ input: "withdrawn old input", output: 8 }] });
const currentFixture = JSON.stringify({ vectors: [{ input: "current corrected input", output: 9 }] });

function receipt(fixtureDigest: string, families: string[] = [sourceFamily]): string {
  return JSON.stringify({
    toolId: "business-day", schemaVersion: 1, status: "GOLD", goldEligible: true,
    revision, sourceFingerprint: fingerprint,
    oracleEntryId: "cand-083", fixtureFamilies: families,
    runtime: { location: "LOCAL", network: "forbidden" },
    identities: {
      manifestSha256: currentManifestSha256,
      [`fixture:${sourceFamily}:sha256`]: fixtureDigest,
    },
  });
}

function proof(content: string, familyHashes: ReadonlyMap<string, string>) {
  return {
    toolId: "business-day",
    path: "quality/receipts/date-time/business-day.gold.json",
    content,
    expectedSha256: sha256(content),
    fingerprint, revision, currentManifestSha256,
    currentFixtureSha256ByFamily: familyHashes,
  };
}

describe("#415 next: proof must bind each declared fixture to current source bytes", () => {
  it("rejects a fully SHA-valid Gold claim over a withdrawn fixture even with current manifest, revision, and global fingerprint", () => {
    const current = new Map([[sourceFamily, sha256(currentFixture)]]);
    const stale = receipt(sha256(withdrawnFixture));
    expect(sha256(withdrawnFixture)).not.toBe(sha256(currentFixture));
    expect(probeReceipt415(proof(stale, current))).toBe(false);

    const refreshed = receipt(sha256(currentFixture));
    expect(probeReceipt415(proof(refreshed, current))).toBe(true);
  });

  it("refuses missing, unbound, or duplicated family proof even when the receipt itself remains correctly hashed", () => {
    const current = new Map([[sourceFamily, sha256(currentFixture)]]);
    const accepted = receipt(sha256(currentFixture));
    expect(probeReceipt415(proof(accepted, new Map()))).toBe(false);
    expect(probeReceipt415(proof(receipt(sha256(currentFixture), [sourceFamily, "withdrawn-alias"]), current))).toBe(false);
    expect(probeReceipt415(proof(receipt(sha256(currentFixture), [sourceFamily, sourceFamily]), current))).toBe(false);

    const noFixtureIdentity = JSON.stringify({
      ...JSON.parse(accepted), identities: { manifestSha256: currentManifestSha256 },
    });
    expect(probeReceipt415(proof(noFixtureIdentity, current))).toBe(false);
  });

  it("reads actual indexed fixture files and invalidates a Gold probe when those bytes are replaced or removed", async () => {
    const root = await mkdtemp(join(tmpdir(), "proof-415-fixtures-"));
    const path = `quality/fixtures/${sourceFamily}/vectors.json`;
    const index = [{ id: sourceFamily, path }];
    try {
      const absolute = join(root, path);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, withdrawnFixture);
      const historical = await readCurrentFixtureHashes415(root, [sourceFamily], index);
      expect(historical?.get(sourceFamily)).toBe(sha256(withdrawnFixture));
      expect(probeReceipt415(proof(receipt(sha256(withdrawnFixture)), historical!))).toBe(true);

      await writeFile(absolute, currentFixture);
      const replaced = await readCurrentFixtureHashes415(root, [sourceFamily], index);
      expect(replaced?.get(sourceFamily)).toBe(sha256(currentFixture));
      expect(probeReceipt415(proof(receipt(sha256(withdrawnFixture)), replaced!))).toBe(false);
      expect(probeReceipt415(proof(receipt(sha256(currentFixture)), replaced!))).toBe(true);

      await rm(absolute);
      expect(await readCurrentFixtureHashes415(root, [sourceFamily], index)).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses fixture aliases through a symlink escaping the checkout", async () => {
    const root = await mkdtemp(join(tmpdir(), "proof-415-root-"));
    const external = await mkdtemp(join(tmpdir(), "proof-415-external-"));
    const path = `quality/fixtures/${sourceFamily}/vectors.json`;
    try {
      const outside = join(external, "vectors.json");
      await writeFile(outside, currentFixture);
      await mkdir(dirname(join(root, path)), { recursive: true });
      await symlink(outside, join(root, path));
      expect(await readCurrentFixtureHashes415(root, [sourceFamily], [{ id: sourceFamily, path }])).toBeNull();
      expect(await readCurrentFixtureHashes415(root, [sourceFamily], [{ id: sourceFamily, path: "quality/fixtures/../../external/vectors.json" }])).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });
});
