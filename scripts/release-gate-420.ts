/**
 * Automatic release admission for the owner decision 20/10/2026 (#162, #80).
 *
 * Runs the canonical validator unchanged, then applies the owner policy:
 * per-tool Gold and physical-device findings are labelled
 * WAIVED_OWNER_DECISION (never PASS), and the automatic evidence the owner
 * requires — browser matrix, simulated phones, proven rollback — must be
 * present, fresh and bound to this exact source.
 *
 * Usage: tsx scripts/release-gate-420.ts --expected-sha=<origin/main sha>
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ReleaseFinding } from "../src/release/validation";
import { OWNER_RELEASE_POLICY_420, assessOwnerPolicy420, distPageHashes420 } from "../src/release/owner-policy-420";
import { currentEvidenceSourceFingerprint } from "./lib/current-revision";
import { fingerprintPublicationAssets404 } from "./prepublish-404";
import { assessRollbackReuse420 } from "../src/release/rollback-reuse-420";
import { inspectReleaseWorkingTree162 } from "./lib/release-evidence-worktree-162";

const ROOT = resolve(import.meta.dirname, "..");
const RECEIPT = "quality/receipts/release/validation-420.json";
const ROLLBACK_RECEIPT = "quality/receipts/release/rollback.json";

const flag = (name: string): string | undefined =>
  process.argv.slice(2).find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

async function json(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(resolve(ROOT, path), "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function canonicalValidation(expectedSha: string | undefined): {
  readonly status: string;
  readonly findings: readonly ReleaseFinding[];
  readonly checks?: Readonly<Record<string, string>>;
} {
  const args = ["node_modules/tsx/dist/cli.mjs", "scripts/validate-release.ts", "--no-write-receipt", "--require-ready"];
  if (expectedSha !== undefined) args.push(`--expected-sha=${expectedSha}`);
  const run = spawnSync("node", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.error) throw run.error;
  if (run.status !== 0 && run.status !== 1) {
    throw new Error(`RELEASE_420_CANONICAL_VALIDATOR_FAILED: exit=${String(run.status)}\n${run.stderr.slice(-2000)}`);
  }
  const output = run.stdout.slice(run.stdout.indexOf("{"));
  let parsed: { status?: unknown; findings?: unknown; checks?: unknown };
  try {
    parsed = JSON.parse(output) as typeof parsed;
  } catch {
    throw new Error(`RELEASE_420_CANONICAL_OUTPUT_UNPARSEABLE\n${run.stdout.slice(-2000)}\n${run.stderr.slice(-2000)}`);
  }
  if (!Array.isArray(parsed.findings)) throw new Error("RELEASE_420_CANONICAL_FINDINGS_MISSING");
  return {
    status: String(parsed.status),
    findings: parsed.findings as ReleaseFinding[],
    ...(typeof parsed.checks === "object" && parsed.checks !== null ? { checks: parsed.checks as Record<string, string> } : {}),
  };
}

async function main(): Promise<void> {
  const expectedSha = flag("expected-sha");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const worktree = inspectReleaseWorkingTree162(ROOT);
  const dirty = worktree.dirty;
  const sourceFingerprint = await currentEvidenceSourceFingerprint(ROOT);
  const canonical = canonicalValidation(expectedSha);
  const distManifestSha256 = await fingerprintPublicationAssets404(resolve(ROOT, "dist"));
  const rollbackReuse = assessRollbackReuse420({
    receipt: await json(ROLLBACK_RECEIPT),
    revision,
    distManifestSha256,
    receiptPath: ROLLBACK_RECEIPT,
  });

  const policy = assessOwnerPolicy420({
    revision,
    sourceFingerprint,
    workingTreeDirty: dirty,
    browserReceipt: await json("quality/receipts/browser-performance/fresh-browser-matrix.json"),
    browserReceiptPath: "quality/receipts/browser-performance/fresh-browser-matrix.json",
    androidReceipt: await json("quality/receipts/android-chrome-avd-277.json"),
    androidReceiptPath: "quality/receipts/android-chrome-avd-277.json",
    iosReceipt: await json("quality/receipts/ios-safari-simulated-281.json"),
    iosReceiptPath: "quality/receipts/ios-safari-simulated-281.json",
    rollbackReceipt: await json(ROLLBACK_RECEIPT),
    rollbackReceiptPath: ROLLBACK_RECEIPT,
    distPageHashes: await distPageHashes420(async (route) => {
      try {
        return await readFile(resolve(ROOT, "dist", route, "index.html"));
      } catch {
        return undefined;
      }
    }),
  });

  // A verified rollback of a byte-identical build is reused on its dist content
  // hash: the stale-source findings become warnings that carry both revisions.
  const reusedStale = (item: ReleaseFinding): ReleaseFinding =>
    item.code === "ROLLBACK_SOURCE_STALE" || item.code === "POLICY_ROLLBACK_SOURCE_STALE"
      ? {
          ...item,
          severity: "warning" as const,
          message: `ROLLBACK_REUSE_420 (${rollbackReuse.record?.provenRevision ?? ""}): ${item.message}`,
        }
      : item;
  const waiver = (item: ReleaseFinding): ReleaseFinding => {
    const reused = rollbackReuse.reused ? reusedStale(item) : item;
    return reused.code.startsWith("GOLD_") || reused.code.startsWith("PHYSICAL_")
      ? {
          ...reused,
          severity: "warning" as const,
          message: `WAIVED_OWNER_DECISION (${OWNER_RELEASE_POLICY_420.id}): ${reused.message}`,
        }
      : reused;
  };
  const waived = canonical.findings.map(waiver);
  const findings = [
    ...waived,
    ...policy.findings.map(waiver),
    ...(rollbackReuse.reused || rollbackReuse.finding === null ? [] : [rollbackReuse.finding]),
  ].sort((left, right) => left.code.localeCompare(right.code));
  const counts = {
    errors: findings.filter((item) => item.severity === "error").length,
    blockers: findings.filter((item) => item.severity === "blocker").length,
    warnings: findings.filter((item) => item.severity === "warning").length,
  };
  const status = counts.errors > 0 ? "FAIL" : counts.blockers > 0 ? "BLOCKED" : "PASS";
  const receipt = {
    schemaVersion: 1,
    kind: "owner-policy-release-admission-420",
    generatedBy: "scripts/release-gate-420.ts",
    generatedAt: new Date().toISOString(),
    revision,
    sourceFingerprint,
    workingTreeDirty: dirty,
    regeneratedEvidencePaths: worktree.evidencePaths,
    status,
    counts,
    policy: {
      id: OWNER_RELEASE_POLICY_420.id,
      decidedAt: OWNER_RELEASE_POLICY_420.decidedAt,
      statement: OWNER_RELEASE_POLICY_420.statement,
      mobileDecision: OWNER_RELEASE_POLICY_420.mobileDecision,
      requiredBrowserEngines: OWNER_RELEASE_POLICY_420.requiredBrowserEngines,
      gates: policy.gates,
      waived: policy.waived,
    },
    canonical: { status: canonical.status, checks: canonical.checks ?? null },
    distManifestSha256,
    rollbackReuse: rollbackReuse.record,
    findings,
  };
  await mkdir(resolve(ROOT, "quality/receipts/release"), { recursive: true });
  await writeFile(resolve(ROOT, RECEIPT), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...receipt, receipt: RECEIPT }, null, 2));
  if (status !== "PASS") {
    console.error(`RELEASE_420_NO_GO: ${counts.errors} error(s), ${counts.blockers} blocker(s)`);
    process.exitCode = 1;
  }
}

await main();
