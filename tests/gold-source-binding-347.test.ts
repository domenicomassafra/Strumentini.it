import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { currentEvidenceSourceFingerprint } from "../scripts/lib/current-revision";
import { buildGoldQualityIndex, buildSourceBoundGoldQualityIndex, renderGoldQualitySource } from "../src/onboarding/quality";
import {
  assertGoldSearchConsistency347,
  auditGoldSourceBinding347,
  type AuditGoldInput347,
  type ReceiptEvidence347,
} from "../scripts/audit-gold-source-binding-347";

const execFileAsync = promisify(execFile);
const revision = "b".repeat(40);
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const path = "quality/receipts/pdf/pdf-rotate.gold.json";
const catalogIds = ["pdf-rotate", "image-resize"];

function evidence(current: string): { input: AuditGoldInput347; projection: Record<string, unknown>; raw: Record<string, unknown> } {
  const contentReceipt = {
    schemaVersion: 1,
    toolId: "pdf-rotate", status: "GOLD", revision, sourceFingerprint: current,
    receiptPath: path, oracleEntryId: "cand-124", fixtureFamilies: ["pdf-gold"],
    runtime: { location: "LOCAL", network: "forbidden" },
    identities: { manifestSha256: sha("manifest") },
  };
  // The generator adds the hash to the in-memory receipt after reading JSON.
  const raw = { ...contentReceipt, receiptSha256: sha(JSON.stringify(contentReceipt)) };
  const content = JSON.stringify(raw);
  const projection = {
    toolId: "pdf-rotate", status: "GOLD", receiptPath: path,
    sourceFingerprint: current, receiptSha256: sha(content),
    oracleEntryIds: ["cand-124"], fixtureFamilies: ["pdf-gold"],
  };
  return {
    projection, raw,
    input: {
      sourceFingerprint: current, revision, workingTreeDirty: false, catalogIds,
      projected: [projection],
      receipts: [{ path, sha256: sha(content), value: raw }],
    },
  };
}

async function withFixture(run: (root: string, fingerprint: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "gold-source-binding-347-"));
  try {
    await execFileAsync("git", ["init", "-q"], { cwd: root });
    await mkdir(join(root, "src", "components"), { recursive: true });
    await mkdir(join(root, "src", "generated"), { recursive: true });
    await mkdir(join(root, "worker", "migrations"), { recursive: true });
    await mkdir(join(root, "quality", "receipts", "pdf"), { recursive: true });
    await writeFile(join(root, "src", "components", "Card.tsx"), "export const verifiedBadge = true;\n");
    await writeFile(join(root, "src", "generated", "quality.ts"),
      renderGoldQualitySource({ schemaVersion: 1, tools: [] }));
    await writeFile(join(root, "src", "generated", "search-catalog.ts"),
      'export const searchCatalog = [{"id":"pdf-rotate","quality":"checking"}];\n');
    await writeFile(join(root, "worker", "index.ts"), "import { verify } from './validation'; export const handle=verify;\n");
    await writeFile(join(root, "worker", "validation.ts"), "export const verify=() => true;\n");
    await writeFile(join(root, "worker", "migrations", "0001_init.sql"), "CREATE TABLE sessions(id TEXT PRIMARY KEY);\n");
    await writeFile(join(root, "quality", "receipts", "pdf", "pdf-rotate.gold.json"), "{}\n");
    await execFileAsync("git", ["add", "."], { cwd: root });
    await run(root, await currentEvidenceSourceFingerprint(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function codes(input: AuditGoldInput347) {
  return auditGoldSourceBinding347(input).findings.find((item) => item.toolId === "pdf-rotate")?.reasons ?? [];
}

describe("#347 Gold badge source binding", () => {
  it("source-bound badge generator suppresses stale, absent, weak and duplicate receipts", () => {
    const { raw } = evidence("a".repeat(64));
    const old = "a".repeat(64);
    const build = (receipts: readonly unknown[], current = old) =>
      buildSourceBoundGoldQualityIndex(receipts, catalogIds, current);
    expect(build([{ ...raw }]).index.tools.map((tool) => tool.toolId)).toEqual(["pdf-rotate"]);
    expect(build([{ ...raw }], "f".repeat(64)).index.tools).toEqual([]);
    expect(build([{ ...raw, sourceFingerprint: undefined }]).index.tools).toEqual([]);
    expect(build([{ ...raw, identities: undefined }]).index.tools).toEqual([]);
    expect(build([{ ...raw, status: "PARTIAL" }]).index.tools).toEqual([]);
    expect(build([{ ...raw }, { ...raw, status: "PARTIAL" }]).index.tools).toEqual([]);
    expect(build([]).index.tools).toEqual([]);
  });

  it("allows only exactly source-bound Gold/receipt-index pairs; a label by itself proves nothing", () => {
    const { input } = evidence("a".repeat(64));
    const result = auditGoldSourceBinding347(input);
    expect(result.status).toBe("PASS");
    expect(result.safeGoldToolIds).toEqual(["pdf-rotate"]);
    expect(result.projectedGoldWithoutProof).toBe(0);
    expect(result.scope.backendIncludedInFingerprint).toEqual(["worker/", "worker/migrations/"]);
    expect(auditGoldSourceBinding347({ ...input, workingTreeDirty: true })).toMatchObject({
      status: "NO_GO", verifiedGoldCount: 0,
    });
  });

  it("reproduces the existing UI generator gap: legacy label survives Worker-only mutations", async () => {
    await withFixture(async (root, before) => {
      const { raw, input } = evidence(before);
      // Current generator checks only status, receipt path, oracle and fixtures.
      const legacyProjection = buildGoldQualityIndex([raw], catalogIds).index;
      expect(legacyProjection.tools.map((item) => item.toolId)).toEqual(["pdf-rotate"]);
      expect(buildSourceBoundGoldQualityIndex([raw], catalogIds, before).index.tools.map((item) => item.toolId)).toEqual(["pdf-rotate"]);
      await writeFile(join(root, "worker", "validation.ts"), "export const verify=() => false;\n");
      const after = await currentEvidenceSourceFingerprint(root);
      expect(after).not.toBe(before);
      expect(buildGoldQualityIndex([raw], catalogIds).index.tools.map((item) => item.toolId)).toEqual(["pdf-rotate"]);
      expect(buildSourceBoundGoldQualityIndex([raw], catalogIds, after).index.tools).toEqual([]);
      // A source-bound projection cannot retain the stale claim.
      const assessment = auditGoldSourceBinding347({ ...input, sourceFingerprint: after });
      expect(assessment.status).toBe("NO_GO");
      expect(assessment.safeGoldToolIds).toEqual([]);
      expect(codes({ ...input, sourceFingerprint: after })).toEqual(expect.arrayContaining([
        "UI_BADGE_SOURCE_UNBOUND", "GOLD_SOURCE_STALE_OR_UNBOUND", "GOLD_RECEIPT_SOURCE_STALE",
      ]));
    });
  });

  it("invalidates on Worker entrypoint and D1 migration SQL, including newly added and deleted migrations", async () => {
    await withFixture(async (root, before) => {
      const { input } = evidence(before);
      await writeFile(join(root, "worker", "index.ts"), "export const handle=()=>({bypass:true});\n");
      expect(codes({ ...input, sourceFingerprint: await currentEvidenceSourceFingerprint(root) })).toContain("GOLD_RECEIPT_SOURCE_STALE");
      await writeFile(join(root, "worker", "index.ts"), "import { verify } from './validation'; export const handle=verify;\n");
      expect(await currentEvidenceSourceFingerprint(root)).toBe(before);
      await writeFile(join(root, "worker", "migrations", "0001_init.sql"), "DROP TABLE sessions;\n");
      expect(codes({ ...input, sourceFingerprint: await currentEvidenceSourceFingerprint(root) })).toContain("GOLD_RECEIPT_SOURCE_STALE");
      await writeFile(join(root, "worker", "migrations", "0001_init.sql"), "CREATE TABLE sessions(id TEXT PRIMARY KEY);\n");
      await writeFile(join(root, "worker", "migrations", "0002_token.sql"), "ALTER TABLE sessions ADD COLUMN token TEXT;\n");
      expect(codes({ ...input, sourceFingerprint: await currentEvidenceSourceFingerprint(root) })).toContain("GOLD_RECEIPT_SOURCE_STALE");
      await unlink(join(root, "worker", "migrations", "0002_token.sql"));
      expect(await currentEvidenceSourceFingerprint(root)).toBe(before);
      await unlink(join(root, "worker", "migrations", "0001_init.sql"));
      expect(codes({ ...input, sourceFingerprint: await currentEvidenceSourceFingerprint(root) })).toContain("GOLD_RECEIPT_SOURCE_STALE");
    });
  });

  it("rejects missing, weak and partial receipts even when the UI still projects Gold", () => {
    const { input, raw } = evidence("a".repeat(64));
    expect(codes({ ...input, receipts: [] })).toEqual(expect.arrayContaining([
      "GOLD_RECEIPT_MISSING", "UI_BADGE_RECEIPT_MISSING",
    ]));
    const incomplete: ReceiptEvidence347 = {
      path, sha256: sha("{}"), value: { ...raw, identities: {}, oracleEntryId: undefined },
    };
    expect(codes({ ...input, receipts: [incomplete] })).toEqual(expect.arrayContaining([
      "GOLD_EVIDENCE_INCOMPLETE", "GOLD_RECEIPT_EVIDENCE_MISSING",
    ]));
    const partial = { ...raw, status: "PARTIAL", goldEligible: false };
    expect(codes({ ...input, receipts: [{ path, value: partial, sha256: sha(JSON.stringify(partial)) }] })).toEqual(expect.arrayContaining([
      "NOT_GOLD", "NOT_GOLD_ELIGIBLE", "GOLD_RECEIPT_NOT_GOLD",
    ]));
  });

  it("rejects duplicated receipts/badges, mismatched hashes, proof IDs and unknown catalog IDs", () => {
    const { input, projection } = evidence("a".repeat(64));
    expect(codes({ ...input, receipts: [...input.receipts, ...input.receipts] })).toContain("DUPLICATE_CERTIFICATION_RECEIPT");
    expect(codes({ ...input, projected: [projection, projection] })).toContain("DUPLICATE_UI_BADGE");
    expect(codes({ ...input, projected: [{ ...projection, receiptSha256: "f".repeat(64) }] })).toContain("UI_BADGE_RECEIPT_HASH_UNBOUND");
    expect(codes({ ...input, projected: [{ ...projection, fixtureFamilies: ["incorrect"] }] })).toContain("UI_BADGE_PROOF_MISMATCH");
    expect(codes({ ...input, catalogIds: ["image-resize"] })).toContain("NOT_IN_CATALOG");
    expect(() => auditGoldSourceBinding347({ ...input, receipts: [{ ...input.receipts[0]!, path: "../receipt.json" }] })).toThrow("invalid receipt inventory");
  });

  it("audits source-matched receipts without self-referential receipt file writes", async () => {
    await withFixture(async (root, before) => {
      const { raw, input } = evidence(before);
      await writeFile(join(root, "quality", "receipts", "pdf", "pdf-rotate.gold.json"), JSON.stringify(raw));
      expect(await currentEvidenceSourceFingerprint(root)).toBe(before);
      expect(auditGoldSourceBinding347(input).status).toBe("PASS");
      await writeFile(join(root, "src", "components", "Card.tsx"), "export const verifiedBadge = false;\n");
      expect(codes({ ...input, sourceFingerprint: await currentEvidenceSourceFingerprint(root) })).toContain("GOLD_RECEIPT_SOURCE_STALE");
    });
  });

  it("reissues a synthetic Gold badge and search verification without changing its certified source identity", async () => {
    await withFixture(async (root, before) => {
      const generated = join(root, "src", "generated");
      await mkdir(generated, { recursive: true });
      const stale = evidence("a".repeat(64)).raw;
      expect(buildSourceBoundGoldQualityIndex([stale], catalogIds, before).index.tools).toEqual([]);

      // Synthetic certification ONLY: the real receipt factory is intentionally not run.
      const { raw, input } = evidence(before);
      // The real generator binds the digest of receipt bytes after reading JSON.
      const refreshed = buildSourceBoundGoldQualityIndex(
        [{ ...raw, receiptSha256: input.receipts[0]!.sha256 }], catalogIds, before,
      );
      expect(refreshed.index.tools.map((tool) => tool.toolId)).toEqual(["pdf-rotate"]);
      await writeFile(join(generated, "quality.ts"), renderGoldQualitySource(refreshed.index));
      await writeFile(join(generated, "search-catalog.ts"),
        'export const searchCatalog = [{"id":"pdf-rotate","quality":"verified"}];\n');
      await writeFile(join(root, "quality", "receipts", "pdf", "pdf-rotate.gold.json"), JSON.stringify(raw));

      expect(await currentEvidenceSourceFingerprint(root)).toBe(before);
      expect(auditGoldSourceBinding347({ ...input, projected: refreshed.index.tools })).toMatchObject({
        status: "PASS", safeGoldToolIds: ["pdf-rotate"], projectedGoldWithoutProof: 0,
      });
      assertGoldSearchConsistency347(catalogIds, refreshed.index.tools, [
        { id: "pdf-rotate", quality: "verified" },
        { id: "image-resize", quality: "checking" },
      ]);
      // A second regeneration with the same proof must reach the same fixed point.
      await writeFile(join(generated, "quality.ts"), renderGoldQualitySource(refreshed.index));
      expect(await currentEvidenceSourceFingerprint(root)).toBe(before);

      await writeFile(join(generated, "quality.ts"),
        renderGoldQualitySource(refreshed.index) + "globalThis.unsafeGoldOverride = true;\n");
      expect(await currentEvidenceSourceFingerprint(root)).not.toBe(before);
      await writeFile(join(generated, "quality.ts"), renderGoldQualitySource(refreshed.index));
      expect(await currentEvidenceSourceFingerprint(root)).toBe(before);

      // Altering actual search metadata remains source tampering, even though
      // toggling its receipt-derived verified label is neutralized.
      await writeFile(join(generated, "search-catalog.ts"),
        'export const searchCatalog = [{"id":"different-tool","quality":"verified"}];\n');
      expect(await currentEvidenceSourceFingerprint(root)).not.toBe(before);
      await writeFile(join(generated, "search-catalog.ts"),
        'export const searchCatalog = [{"id":"pdf-rotate","quality":"verified"}];\n');
      expect(await currentEvidenceSourceFingerprint(root)).toBe(before);

      await mkdir(join(root, "public"), { recursive: true });
      await writeFile(join(root, "public", "new-worker-asset.svg"), "<svg/>\n");
      expect(await currentEvidenceSourceFingerprint(root)).not.toBe(before);
      await unlink(join(root, "public", "new-worker-asset.svg"));
      expect(await currentEvidenceSourceFingerprint(root)).toBe(before);

      await writeFile(join(root, "worker", "validation.ts"), "export const verify=() => false;\n");
      const tampered = await currentEvidenceSourceFingerprint(root);
      expect(tampered).not.toBe(before);
      expect(buildSourceBoundGoldQualityIndex([raw], catalogIds, tampered).index.tools).toEqual([]);
      expect(codes({ ...input, projected: refreshed.index.tools, sourceFingerprint: tampered }))
        .toEqual(expect.arrayContaining(["UI_BADGE_SOURCE_UNBOUND", "GOLD_RECEIPT_SOURCE_STALE"]));
    });
  });

  it("rejects a forged search verification even when its quality flag cannot affect the versioned digest", () => {
    const { input } = evidence("a".repeat(64));
    expect(() => assertGoldSearchConsistency347(catalogIds, [], [
      { id: "pdf-rotate", quality: "verified" },
      { id: "image-resize", quality: "checking" },
    ])).toThrow(/search.*Gold/u);
    expect(() => assertGoldSearchConsistency347(catalogIds, input.projected, [
      { id: "pdf-rotate", quality: "checking" },
      { id: "image-resize", quality: "checking" },
    ])).toThrow(/search.*Gold/u);
  });
});
