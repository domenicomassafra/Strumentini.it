import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { currentEvidenceSourceFingerprint, EVIDENCE_SOURCE_SCOPE_VERSION } from "../scripts/lib/current-revision";

const execFileAsync = promisify(execFile);
const sourceRoot = resolve(import.meta.dirname, "..");
const producerPath = "scripts/acceptance/browser-performance-matrix.mjs";
const receiptPath = "quality/receipts/browser-performance/fresh-browser-matrix.json";

async function sourceCheck(root: string): Promise<{ exitCode: number; output: string }> {
  try {
    const run = await execFileAsync(process.execPath, [resolve(root, producerPath), "--check"], {
      cwd: root, timeout: 12_000,
    });
    return { exitCode: 0, output: `${run.stdout}${run.stderr}` };
  } catch (error) {
    const failure = error as Error & { code?: number; stdout?: string; stderr?: string };
    if (typeof failure.code !== "number") throw failure;
    return { exitCode: failure.code, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

async function withSourceFixture(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "browser-evidence-fingerprint-347-"));
  try {
    for (const folder of ["scripts/acceptance", "scripts/lib", "worker/migrations", "src/generated", "quality/receipts/browser-performance"]) {
      await mkdir(resolve(root, folder), { recursive: true });
    }
    await copyFile(resolve(sourceRoot, producerPath), resolve(root, producerPath));
    await copyFile(resolve(sourceRoot, "scripts/acceptance/browser-performance-verdict.mjs"),
      resolve(root, "scripts/acceptance/browser-performance-verdict.mjs"));
    await copyFile(resolve(sourceRoot, "scripts/acceptance/browser-performance-siblings.mjs"),
      resolve(root, "scripts/acceptance/browser-performance-siblings.mjs"));
    await copyFile(resolve(sourceRoot, "scripts/lib/current-revision.ts"), resolve(root, "scripts/lib/current-revision.ts"));
    await writeFile(resolve(root, "worker/index.ts"), "export const mode = 'local';\n");
    await writeFile(resolve(root, "worker/migrations/0001_local.sql"), "CREATE TABLE local_only (id TEXT);\n");
    await writeFile(resolve(root, "src/generated/quality.ts"),
      '// generated\nimport type { GoldQualityIndex } from "../onboarding/quality";\nexport const qualityIndex = {"schemaVersion":1,"tools":[]} as const satisfies GoldQualityIndex;\n');
    await writeFile(resolve(root, "src/generated/search-catalog.ts"),
      'export const searchCatalog = [{"id":"pdf-rotate","quality":"checking"}];\n');
    await symlink(resolve(sourceRoot, "node_modules"), resolve(root, "node_modules"), "dir");
    await execFileAsync("git", ["init", "-q"], { cwd: root });
    await execFileAsync("git", ["add", "--", "scripts", "worker", "src"], { cwd: root });
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("#347 canonical browser matrix source evidence", () => {
  it("--check is read-only, rejects historic/unbound receipts, and accepts only canonical-v2 bound evidence", async () => {
    await withSourceFixture(async (root) => {
      const receipt = resolve(root, receiptPath);
      expect((await sourceCheck(root)).exitCode).not.toBe(0);
      const fingerprint = await currentEvidenceSourceFingerprint(root);
      const legacy = { schemaVersion: 1, revision: "c".repeat(40), sourceFingerprint: "a".repeat(64) };
      await writeFile(receipt, JSON.stringify(legacy));
      expect((await sourceCheck(root)).exitCode).not.toBe(0);

      const current = { ...legacy, sourceFingerprint: fingerprint, sourceScopeVersion: EVIDENCE_SOURCE_SCOPE_VERSION };
      const contents = JSON.stringify(current);
      await writeFile(receipt, contents);
      const positive = await sourceCheck(root);
      expect(positive.exitCode, positive.output).toBe(0);
      expect(positive.output).toMatch(/source binding current/iu);
      expect(await readFile(receipt, "utf8")).toBe(contents);
      expect(await currentEvidenceSourceFingerprint(root)).toBe(fingerprint);

      // A same-source legacy scope is not an interchangeable current receipt.
      await writeFile(receipt, JSON.stringify({ ...current, sourceScopeVersion: undefined }));
      expect((await sourceCheck(root)).exitCode).not.toBe(0);
      await writeFile(receipt, contents);

      await writeFile(resolve(root, "worker/index.ts"), "export const mode = 'bypass';\n");
      const modifiedWorker = await sourceCheck(root);
      expect(modifiedWorker.exitCode).not.toBe(0);
      expect(modifiedWorker.output).toMatch(/stale/iu);
      expect(await readFile(receipt, "utf8")).toBe(contents);
    });
  }, 40_000);

  it("--check fails closed when a D1 migration is newly added, without creating or refreshing evidence", async () => {
    await withSourceFixture(async (root) => {
      const receipt = resolve(root, receiptPath);
      const fingerprint = await currentEvidenceSourceFingerprint(root);
      const bytes = JSON.stringify({ schemaVersion: 1, revision: "d".repeat(40), sourceFingerprint: fingerprint,
        sourceScopeVersion: EVIDENCE_SOURCE_SCOPE_VERSION });
      await writeFile(receipt, bytes);
      expect((await sourceCheck(root)).exitCode).toBe(0);
      await writeFile(resolve(root, "worker/migrations/0002_remote.sql"), "CREATE TABLE accounts (id TEXT);\n");
      const outcome = await sourceCheck(root);
      expect(outcome.exitCode).not.toBe(0);
      expect(outcome.output).toMatch(/stale/iu);
      expect(await readFile(receipt, "utf8")).toBe(bytes);
    });
  }, 40_000);

  it("repository browser receipt stays byte-identical under --check and is accepted only when truly source-current", async () => {
    const receipt = resolve(sourceRoot, receiptPath);
    const before = await readFile(receipt, "utf8");
    const observed = JSON.parse(before) as { sourceFingerprint?: string; sourceScopeVersion?: string };
    const actuallyCurrent = observed.sourceFingerprint === await currentEvidenceSourceFingerprint(sourceRoot)
      && observed.sourceScopeVersion === EVIDENCE_SOURCE_SCOPE_VERSION;
    const result = await sourceCheck(sourceRoot);
    // This regression used to assert the particular 2026-10-10 receipt must
    // always remain stale, which would incorrectly reject the genuine fresh
    // evidence producer after it was executed on a reviewed source SHA.
    // Old/unbound evidence is still refused by the two adversarial tests above.
    expect(result.exitCode === 0).toBe(actuallyCurrent);
    expect(await readFile(receipt, "utf8")).toBe(before);
  }, 25_000);
});
