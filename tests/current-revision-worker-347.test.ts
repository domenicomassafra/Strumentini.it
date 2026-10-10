import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { currentEvidenceSourceFingerprint } from "../scripts/lib/current-revision";
import { validateGoldReceipts } from "../src/release/validation";

const execFileAsync = promisify(execFile);

async function withFingerprintFixture(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "strumentini-worker-347-"));
  try {
    await execFileAsync("git", ["init", "-q"], { cwd: root });
    await mkdir(join(root, "worker", "migrations"), { recursive: true });
    await mkdir(join(root, "src", "tools", "example"), { recursive: true });
    await mkdir(join(root, "quality", "receipts"), { recursive: true });
    await writeFile(join(root, "package.json"), '{"name":"fixture"}\n');
    await writeFile(join(root, "wrangler.jsonc"), '{"main":"worker/index.ts","d1_databases":[{"migrations_dir":"worker/migrations"}]}\n');
    await writeFile(join(root, "src", "tools", "example", "manifest.ts"), 'export const id = "example";\n');
    await writeFile(join(root, "worker", "index.ts"), 'import { validate } from "./validation"; export const run = validate;\n');
    await writeFile(join(root, "worker", "validation.ts"), "export const validate = () => true;\n");
    await writeFile(join(root, "worker", "migrations", "0001_init.sql"), "CREATE TABLE users (id TEXT PRIMARY KEY);\n");
    await writeFile(join(root, "quality", "receipts", "historic.json"), '{"status":"GOLD"}\n');
    await execFileAsync("git", ["add", "."], { cwd: root });
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function findingsForPriorGold(sourceFingerprint: string, oldFingerprint: string): string[] {
  return validateGoldReceipts(
    [{ id: "example", route: "/tools/example" }],
    [{
      toolId: "example",
      status: "GOLD",
      schemaVersion: 1,
      runtime: "client",
      oracleEntryId: "example-oracle",
      fixtureFamilies: ["example-fixture"],
      identities: { code: "frozen" },
      revision: "fixture-revision",
      sourceFingerprint: oldFingerprint,
    }],
    "fixture-revision",
    sourceFingerprint,
  ).map((item) => item.code);
}

describe("#347 backend-inclusive release evidence fingerprint", () => {
  it("invalidates a formerly matching Gold claim if deployed Worker entrypoint changes", async () => {
    await withFingerprintFixture(async (root) => {
      const certified = await currentEvidenceSourceFingerprint(root);
      expect(findingsForPriorGold(certified, certified)).toEqual([]);

      await writeFile(join(root, "worker", "index.ts"), "export const run = () => ({ allow: true });\n");
      const tampered = await currentEvidenceSourceFingerprint(root);
      expect(tampered).not.toBe(certified);
      expect(findingsForPriorGold(tampered, certified)).toContain("GOLD_RECEIPT_SOURCE_STALE");
    });
  });

  it("invalidates on imported Worker helpers and D1 migration SQL modifications", async () => {
    await withFingerprintFixture(async (root) => {
      const certified = await currentEvidenceSourceFingerprint(root);
      await writeFile(join(root, "worker", "validation.ts"), "export const validate = () => false;\n");
      const changedHelper = await currentEvidenceSourceFingerprint(root);
      expect(changedHelper).not.toBe(certified);
      expect(findingsForPriorGold(changedHelper, certified)).toContain("GOLD_RECEIPT_SOURCE_STALE");

      await writeFile(join(root, "worker", "validation.ts"), "export const validate = () => true;\n");
      expect(await currentEvidenceSourceFingerprint(root)).toBe(certified);
      await writeFile(join(root, "worker", "migrations", "0001_init.sql"), "DROP TABLE users;\n");
      const changedMigration = await currentEvidenceSourceFingerprint(root);
      expect(changedMigration).not.toBe(certified);
      expect(findingsForPriorGold(changedMigration, certified)).toContain("GOLD_RECEIPT_SOURCE_STALE");
    });
  });

  it("includes added and deleted backend files, including untracked migrations", async () => {
    await withFingerprintFixture(async (root) => {
      const certified = await currentEvidenceSourceFingerprint(root);
      await writeFile(join(root, "worker", "migrations", "0002_token.sql"), "ALTER TABLE users ADD COLUMN token TEXT;\n");
      const added = await currentEvidenceSourceFingerprint(root);
      expect(added).not.toBe(certified);
      await unlink(join(root, "worker", "migrations", "0002_token.sql"));
      expect(await currentEvidenceSourceFingerprint(root)).toBe(certified);
      await unlink(join(root, "worker", "validation.ts"));
      const deleted = await currentEvidenceSourceFingerprint(root);
      expect(deleted).not.toBe(certified);
      expect(findingsForPriorGold(deleted, certified)).toContain("GOLD_RECEIPT_SOURCE_STALE");
    });
  });

  it("keeps generated receipt writes and unrelated documentation outside the digest", async () => {
    await withFingerprintFixture(async (root) => {
      const certified = await currentEvidenceSourceFingerprint(root);
      await writeFile(join(root, "quality", "receipts", "historic.json"), '{"status":"NO_GO"}\n');
      await writeFile(join(root, "README.md"), "Unrelated copy update.\n");
      expect(await currentEvidenceSourceFingerprint(root)).toBe(certified);
      await writeFile(join(root, "wrangler.jsonc"), '{"main":"worker/index.ts","d1_databases":[]}\n');
      expect(await currentEvidenceSourceFingerprint(root)).not.toBe(certified);
    });
  });
});
