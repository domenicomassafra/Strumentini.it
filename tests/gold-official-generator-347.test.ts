import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { currentEvidenceSourceFingerprint } from "../scripts/lib/current-revision";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "..");
const syntheticReceiptPath = "quality/receipts/synthetic-347/pdf-rotate.gold.json";
const originalReceiptPath = "quality/receipts/pdf/pdf-rotate.gold.json";
const qualityPath = "src/generated/quality.ts";
const searchPath = "src/generated/search-catalog.ts";
const syntheticRevision = "f".repeat(40);

async function officialGenerator(root: string, check = false): Promise<string> {
  const cli = resolve(projectRoot, "node_modules/tsx/dist/cli.mjs");
  const script = resolve(root, "scripts/tool-factory/generate-catalog.ts");
  const result = await execFileAsync(process.execPath, [cli, script, ...(check ? ["--check"] : [])], {
    cwd: root, timeout: 120_000, maxBuffer: 2 * 1024 * 1024,
  });
  return result.stdout;
}

function generatedJson(source: string, name: string): unknown {
  const marker = `export const ${name} = `;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Generated ${name} export missing`);
  const end = source.indexOf(" as const", start + marker.length);
  if (end === -1) throw new Error(`Generated ${name} suffix missing`);
  return JSON.parse(source.slice(start + marker.length, end)) as unknown;
}

async function generatedGold(root: string) {
  const quality = generatedJson(await readFile(resolve(root, qualityPath), "utf8"), "qualityIndex") as {
    tools: { toolId: string; sourceFingerprint: string; receiptPath: string; receiptSha256: string }[];
  };
  const search = generatedJson(await readFile(resolve(root, searchPath), "utf8"), "searchCatalog") as {
    id: string; quality: string; keywords: string[];
  }[];
  return { quality, search };
}

async function sourceOutputs(root: string) {
  const files = [
    "src/generated/catalog.ts", "src/generated/tool-loaders.ts", "src/generated/search-catalog.ts",
    "src/generated/workbench-catalog.ts", "src/generated/runtime-tool-index.ts",
    "src/generated/handoff-catalog.ts", "src/catalog/result-v2-inventory.generated.ts", qualityPath,
  ];
  return Promise.all(files.map(async (name) => [name, await readFile(resolve(root, name), "utf8")] as const));
}

async function withOfficialFixture(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "gold-official-generator-347-"));
  try {
    // Real catalog pipeline, source, registries, migration tickets and historical
    // fixture evidence; ONLY node_modules is linked, and NO files outside this
    // disposable Git repo may be written by the official generator.
    for (const path of ["src", "scripts", "tests", "worker", "public", "quality", ".scratch"]) {
      await cp(resolve(projectRoot, path), resolve(root, path), { recursive: true });
    }
    for (const file of ["astro.config.mjs", "package.json", "package-lock.json", "tsconfig.json", "wrangler.jsonc", ".gitignore"]) {
      await cp(resolve(projectRoot, file), resolve(root, file));
    }
    await symlink(resolve(projectRoot, "node_modules"), resolve(root, "node_modules"), "dir");
    await execFileAsync("git", ["init", "-q"], { cwd: root });
    // An uncommitted temp Git index suffices for the real source scope;
    // this never makes a commit, changes shared history or issues a receipt.
    await execFileAsync("git", ["add", "-f", "--", "src", "scripts", "tests", "worker", "public", "quality/fixtures", "quality/oracles"], {
      cwd: root, maxBuffer: 1024 * 1024,
    });
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("#347 actual official catalog generator — synthetic isolated reissue", () => {
  it("projects synthetic source-matched Gold through real generator, stays at a fixed point, and revokes on Worker/D1 changes", async () => {
    await withOfficialFixture(async (root) => {
      // Prevent duplicate per-tool Gold candidates inside this disposable copy.
      // The original historical receipt in the user's checkout is untouched.
      await unlink(resolve(root, originalReceiptPath));

      const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
      expect(sourceFingerprint).toMatch(/^[a-f0-9]{64}$/u);
      expect(await officialGenerator(root)).toMatch(/269 tool\(s\), Gold receipts 0/u);
      const baseline = await generatedGold(root);
      expect(baseline.quality.tools).toEqual([]);
      expect(baseline.search).toHaveLength(269);
      expect(baseline.search.every((tool) => tool.quality === "checking")).toBe(true);
      expect(await currentEvidenceSourceFingerprint(root)).toBe(sourceFingerprint);

      // This synthetic receipt exists ONLY in the temporary repository. It
      // exercises the current source/version/identity gate but claims no real
      // certification, real oracle validation, device acceptance or release.
      const receipt = {
        schemaVersion: 1, syntheticFixtureOnly: true,
        toolId: "pdf-rotate", status: "GOLD", revision: syntheticRevision,
        sourceFingerprint, runtime: { location: "LOCAL", network: "forbidden" },
        oracleEntryId: "cand-124", fixtureFamilies: ["pdf-signature", "pdf-gold"],
        identities: { testOnlyProvenance: "synthetic-generator-fingerprint-fixture-347" },
      };
      await mkdir(resolve(root, "quality/receipts/synthetic-347"), { recursive: true });
      const receiptBytes = `${JSON.stringify(receipt, null, 2)}\n`;
      await writeFile(resolve(root, syntheticReceiptPath), receiptBytes);
      const receiptHash = createHash("sha256").update(receiptBytes).digest("hex");
      expect(await currentEvidenceSourceFingerprint(root)).toBe(sourceFingerprint);

      expect(await officialGenerator(root)).toMatch(/269 tool\(s\), Gold receipts 1/u);
      const positive = await generatedGold(root);
      expect(positive.quality.tools).toEqual([{
        toolId: "pdf-rotate", status: "GOLD", receiptPath: syntheticReceiptPath,
        oracleEntryIds: ["cand-124"], fixtureFamilies: ["pdf-signature", "pdf-gold"],
        sourceFingerprint, receiptSha256: receiptHash,
      }]);
      expect(positive.search).toHaveLength(269);
      expect(positive.search.filter((tool) => tool.quality === "verified").map((tool) => tool.id)).toEqual(["pdf-rotate"]);
      expect(positive.search.find((tool) => tool.id === "pdf-rotate")?.keywords)
        .toEqual(baseline.search.find((tool) => tool.id === "pdf-rotate")?.keywords);
      expect(await currentEvidenceSourceFingerprint(root)).toBe(sourceFingerprint);
      const positiveOutputs = await sourceOutputs(root);
      expect(await officialGenerator(root, true)).toMatch(/269 tool\(s\), Gold receipts 1, outputs current/u);
      expect(await officialGenerator(root)).toMatch(/269 tool\(s\), Gold receipts 1/u);
      expect(await sourceOutputs(root)).toEqual(positiveOutputs);
      expect(await readFile(resolve(root, syntheticReceiptPath), "utf8")).toBe(receiptBytes);

      // Backend-only changes MUST change the source identity, reject the
      // previously matched synthetic receipt and clear BOTH public views.
      const migration = resolve(root, "worker/migrations/0000_synthetic_change.sql");
      await writeFile(migration, "CREATE TABLE __synthetic347 (id TEXT PRIMARY KEY);\n");
      const alteredFingerprint = await currentEvidenceSourceFingerprint(root);
      expect(alteredFingerprint).not.toBe(sourceFingerprint);
      // Checking previously generated Gold must reject the stale output
      // rather than silently presenting yesterday's verified badge.
      await expect(officialGenerator(root, true)).rejects.toThrow(/stale/u);
      expect(await officialGenerator(root)).toMatch(/269 tool\(s\), Gold receipts 0/u);
      const tampered = await generatedGold(root);
      expect(tampered.quality.tools).toEqual([]);
      expect(tampered.search.every((tool) => tool.quality === "checking")).toBe(true);
      expect(await currentEvidenceSourceFingerprint(root)).toBe(alteredFingerprint);
      expect(await officialGenerator(root, true)).toMatch(/269 tool\(s\), Gold receipts 0, outputs current/u);
      expect(await readFile(resolve(root, syntheticReceiptPath), "utf8")).toBe(receiptBytes);
      // Adding a migration is already enough; a Worker entrypoint edit must
      // independently invalidate the same global identity as well.
      await rm(migration);
      expect(await currentEvidenceSourceFingerprint(root)).toBe(sourceFingerprint);
      await writeFile(resolve(root, "worker/index.ts"), "export const changedWorker347 = true;\n");
      expect(await currentEvidenceSourceFingerprint(root)).not.toBe(sourceFingerprint);
      expect(await officialGenerator(root)).toMatch(/269 tool\(s\), Gold receipts 0/u);
      expect((await generatedGold(root)).quality.tools).toEqual([]);
    });
  }, 180_000);
});
