import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditGoldSourceBinding347, type AuditGoldResult347 } from "../scripts/audit-gold-source-binding-347";
import { mergeReleaseGoldAudit347 } from "../scripts/validate-release";
import { currentEvidenceSourceFingerprint } from "../scripts/lib/current-revision";
import { validateGoldReceipts, type ReleaseValidationResult } from "../src/release/validation";

const revision = "a".repeat(40);
const sourceFingerprint = "b".repeat(64);
const toolId = "pdf-rotate";
const receiptPath = "quality/receipts/pdf/pdf-rotate.gold.json";
const catalog = [{ id: toolId, route: "/tools/pdf-rotate" }];
const repository = resolve(import.meta.dirname, "..");

const baseResult: ReleaseValidationResult = {
  schemaVersion: 1, status: "PASS", expectedToolCount: 1,
  catalogToolCount: 1, manifestCount: 1, toolPageCount: 1,
  findings: [], counts: { errors: 0, blockers: 0, warnings: 0 },
};

function receipt() {
  return {
    schemaVersion: 1, toolId, status: "GOLD", revision, sourceFingerprint,
    runtime: { location: "LOCAL", network: "forbidden" },
    oracleEntryId: "oracle-pdf", fixtureFamilies: ["pdf-fixture"],
    identities: { testProof: "original independently checked evidence" },
  };
}

function audit(raw: ReturnType<typeof receipt>, boundHash: string): AuditGoldResult347 {
  return auditGoldSourceBinding347({
    sourceFingerprint, revision, workingTreeDirty: false, catalogIds: [toolId],
    projected: [{
      toolId, status: "GOLD", sourceFingerprint, receiptPath, receiptSha256: boundHash,
      oracleEntryIds: ["oracle-pdf"], fixtureFamilies: ["pdf-fixture"],
    }],
    receipts: [{ path: receiptPath, sha256: createHash("sha256").update(JSON.stringify(raw)).digest("hex"), value: raw }],
  });
}

function fixtureFile(root: string, path: string, contents?: string): void {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  if (contents === undefined) cpSync(resolve(repository, path), target);
  else writeFileSync(target, contents);
}

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 8_000 }).trim();
}

function fixtureCommit(root: string): void {
  git(root, "add", "-A");
  // Commits exist only in this disposable fixture; the user's Git repo is not modified.
  git(root, "-c", "user.name=347 Fixture", "-c", "user.email=fixture347@example.invalid", "commit", "-qm", "fixture-only");
}

function releaseCli(root: string): { checks: { gold: string }; receipt: string | null; findings: { code: string }[] } {
  const cli = resolve(repository, "node_modules/tsx/dist/cli.mjs");
  const run = spawnSync(process.execPath, [cli, resolve(root, "scripts/validate-release.ts"), "--no-write-receipt"], {
    cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
  });
  if (run.error || !run.stdout.trim()) throw new Error(`release CLI failed before JSON result: ${run.error?.message ?? run.stderr}`);
  // Other release checks correctly fail in this minimal test fixture without
  // dist or physical evidence. Only the Gold check is the subject here.
  return JSON.parse(run.stdout) as { checks: { gold: string }; receipt: string | null; findings: { code: string }[] };
}

async function withReleaseFixture(run: (root: string) => Promise<void>): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "wave20-gold-release-347-"));
  try {
    for (const path of [
      "scripts/validate-release.ts", "scripts/audit-gold-source-binding-347.ts", "scripts/lib/current-revision.ts",
      // Release validation now imports the #404 authoritative remote helper.
      // Even though this fixture invokes --no-write-receipt without the
      // manual release gate, copy its transitive source so the synthetic CLI
      // can be loaded and continue proving genuine Gold byte binding.
      "scripts/lib/current-remote-main-404.ts",
      "src/release/validation.ts", "src/release/preview-boundary.ts", "src/catalog/groups.ts",
      "src/seo/public-discovery.ts",
    ]) fixtureFile(root, path);
    fixtureFile(root, "src/generated/catalog.ts", 'export const catalog = [{"id":"pdf-rotate","route":"/tools/pdf-rotate","category":"documents"}];\n');
    fixtureFile(root, "src/generated/quality.ts", 'export const qualityIndex = {"schemaVersion":1,"tools":[]} as const satisfies GoldQualityIndex;\n');
    fixtureFile(root, "src/generated/search-catalog.ts", 'export const searchCatalog = [{"id":"pdf-rotate","quality":"checking"}];\n');
    fixtureFile(root, "src/tools/pdf-rotate/manifest.ts", 'export default {id:"pdf-rotate",route:"/tools/pdf-rotate"};\n');
    for (const path of ["src/pages/index.astro", "src/pages/tools/pdf-rotate.astro", "src/layouts/BaseLayout.astro", "src/components/shell/ShellChrome.astro"]) {
      fixtureFile(root, path, "<div>synthetic fixture only</div>\n");
    }
    fixtureFile(root, "quality/oracles/registry.json", JSON.stringify({ schema_version: 1, entry_count: 1, entries: [{ id: "oracle-pdf" }] }));
    fixtureFile(root, "package.json", '{"name":"synthetic-wave20-347","private":true,"type":"module"}\n');
    fixtureFile(root, "wrangler.jsonc", '{"compatibility_date":"2026-10-12","assets":{"directory":"./dist","not_found_handling":"404-page"}}');
    symlinkSync(resolve(repository, "node_modules"), resolve(root, "node_modules"), "dir");
    git(root, "init", "-q");
    fixtureCommit(root);
    await run(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

describe("#347 wave20 release validator binds public Gold to authentic receipt bytes", () => {
  it("rejects a tampered genuine-shape Gold receipt even when the old release check would accept it", () => {
    const original = receipt();
    const originalHash = createHash("sha256").update(JSON.stringify(original)).digest("hex");
    const accepted = audit(original, originalHash);
    expect(accepted).toMatchObject({ status: "PASS", safeGoldToolIds: [toolId] });
    expect(mergeReleaseGoldAudit347(baseResult, accepted)).toEqual(baseResult);

    // The only changed bytes are in the claimed proof, which was not parsed
    // by validateGoldReceipts; Gold status and canonical source digest remain.
    const altered = { ...original, identities: { testProof: "altered unverified evidence" } };
    expect(validateGoldReceipts(catalog, [altered], revision, sourceFingerprint)).toEqual([]);
    const hostile = audit(altered, originalHash);
    expect(hostile.findings[0]?.reasons).toContain("UI_BADGE_RECEIPT_HASH_UNBOUND");

    const release = mergeReleaseGoldAudit347(baseResult, hostile);
    expect(release.status).toBe("FAIL");
    expect(release.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "GOLD_PUBLIC_SOURCE_BINDING_FAILED", severity: "error" }),
    ]));
    expect(release.counts.errors).toBe(1);
  });

  it("fails closed if public Gold audit cannot inspect a malformed projection", () => {
    const release = mergeReleaseGoldAudit347(baseResult, new Error("generated Gold/search inventory invalid"));
    expect(release).toMatchObject({ status: "FAIL", counts: { errors: 1, blockers: 0, warnings: 0 } });
    expect(release.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "GOLD_PUBLIC_SOURCE_AUDIT_FAILED", severity: "error" }),
    ]));
  });

  it("actual release CLI changes Gold PASS to FAIL after only synthetic authentic receipt bytes change", async () => {
    await withReleaseFixture(async (root) => {
      const source = await currentEvidenceSourceFingerprint(root);
      const raw = { ...receipt(), sourceFingerprint: source };
      const receiptBytes = `${JSON.stringify(raw)}\n`;
      const receiptHash = createHash("sha256").update(receiptBytes).digest("hex");
      fixtureFile(root, receiptPath, receiptBytes);
      fixtureFile(root, "src/generated/quality.ts", `export const qualityIndex = ${JSON.stringify({ schemaVersion: 1, tools: [{ toolId, status: "GOLD", sourceFingerprint: source, receiptPath, receiptSha256: receiptHash, oracleEntryIds: ["oracle-pdf"], fixtureFamilies: ["pdf-fixture"] }] })} as const satisfies GoldQualityIndex;\n`);
      fixtureFile(root, "src/generated/search-catalog.ts", 'export const searchCatalog = [{"id":"pdf-rotate","quality":"verified"}];\n');
      expect(await currentEvidenceSourceFingerprint(root)).toBe(source);
      fixtureCommit(root);
      const positive = releaseCli(root);
      expect(positive.checks.gold).toBe("PASS");
      expect(positive.receipt).toBeNull();

      // The source digest excludes quality/receipts by design, so rewriting
      // evidence details can leave the old superficial Gold fields matching.
      const tamperedBytes = `${JSON.stringify({ ...raw, identities: { testProof: "tampered but still well-shaped" } })}\n`;
      fixtureFile(root, receiptPath, tamperedBytes);
      fixtureCommit(root);
      expect(await currentEvidenceSourceFingerprint(root)).toBe(source);
      const rejected = releaseCli(root);
      expect(rejected.checks.gold).toBe("FAIL");
      expect(rejected.findings.map((f) => f.code)).toContain("GOLD_PUBLIC_SOURCE_BINDING_FAILED");
      expect(readFileSync(resolve(root, receiptPath), "utf8")).toBe(tamperedBytes);
      expect(existsSync(resolve(root, "quality/receipts/release"))).toBe(false);
    });
  }, 60_000);
});
