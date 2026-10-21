/**
 * #405 / owner decision 20/10/2026: prove rollback on the isolated staging
 * Worker before production promotion. Never touches the production Worker or D1.
 *
 * Sequence on the host that owns the Cloudflare session:
 *   1. record the currently served staging version and its home-page bytes;
 *   2. deploy the candidate from this checkout (staging:deploy:328);
 *   3. roll back to the recorded version and verify the served bytes match;
 *   4. restore the candidate and verify its bytes again;
 *   5. write a VERIFIED rollback receipt bound to this revision/fingerprint.
 *
 * Usage: tsx scripts/staging-rollback-420.ts --receipt=quality/receipts/release/rollback.json
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { currentEvidenceSourceFingerprint } from "./lib/current-revision";

const ROOT = resolve(import.meta.dirname, "..");
const STAGING_ORIGIN = "https://strumentini-328-staging-20261015.massafradomenico4.workers.dev";
const STAGES_CONFIG = "worker/wrangler.staging.jsonc";
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

function arg(name: string): string | undefined {
  return process.argv.slice(2).find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function wrangler(args: readonly string[]): string {
  return execFileSync("npx", ["wrangler", ...args, "--config", STAGES_CONFIG], {
    cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
}

function wranglerRun(args: readonly string[]): void {
  execFileSync("npx", ["wrangler", ...args, "--config", STAGES_CONFIG], { cwd: ROOT, stdio: "inherit" });
}

function currentVersion(): { id: string; versionId: string } {
  const output = wrangler(["deployments", "status", "--json"]);
  const parsed = JSON.parse(output) as { id?: unknown; versions?: { version_id?: unknown; percentage?: unknown }[] };
  const version = parsed.versions?.find((item) => item.percentage === 100)?.version_id;
  if (typeof parsed.id !== "string" || typeof version !== "string") {
    throw new Error("STAGING_ROLLBACK_STATUS_UNREADABLE");
  }
  return { id: parsed.id, versionId: version };
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

async function homeHash(): Promise<string> {
  const response = await fetch(`${STAGING_ORIGIN}/`, { redirect: "follow", headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`STAGING_ROLLBACK_HOME_HTTP_${response.status}`);
  return sha256(new Uint8Array(await response.arrayBuffer()));
}

async function waitForHome(expected: string, label: string): Promise<string> {
  let last = "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    last = await homeHash();
    if (last === expected) return last;
    await sleep(4000);
  }
  throw new Error(`STAGING_ROLLBACK_RESTORE_MISMATCH_${label}: expected ${expected}, served ${last}`);
}

async function main(): Promise<void> {
  const receiptPath = resolve(ROOT, arg("receipt") ?? "quality/receipts/release/rollback.json");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim().length > 0;
  if (dirty) throw new Error("STAGING_ROLLBACK_DIRTY_WORKTREE");
  const sourceFingerprint = await currentEvidenceSourceFingerprint(ROOT);

  const previous = currentVersion();
  const previousHome = await homeHash();
  console.log(`STAGING_ROLLBACK_PREVIOUS ${previous.versionId} ${previousHome}`);

  execFileSync("npm", ["run", "staging:deploy:328"], { cwd: ROOT, stdio: "inherit" });
  const candidate = currentVersion();
  if (candidate.versionId === previous.versionId) throw new Error("STAGING_ROLLBACK_CANDIDATE_NOT_NEW");
  let candidateHome = await homeHash();
  for (let attempt = 0; attempt < 20 && candidateHome === previousHome; attempt += 1) {
    await sleep(4000);
    candidateHome = await homeHash();
  }
  if (candidateHome === previousHome) throw new Error("STAGING_ROLLBACK_CANDIDATE_BYTES_IDENTICAL");
  console.log(`STAGING_ROLLBACK_CANDIDATE ${candidate.versionId} ${candidateHome}`);

  const previousRollbackCommand = `wrangler rollback ${previous.versionId} --config ${STAGES_CONFIG}`;
  wranglerRun(["rollback", previous.versionId, "--message", "STR-405 owner-policy rollback drill"]);
  const restoredPrevious = await waitForHome(previousHome, "PREVIOUS");
  console.log(`STAGING_ROLLBACK_RESTORED_PREVIOUS ${restoredPrevious}`);

  wranglerRun(["rollback", candidate.versionId, "--message", "STR-405 owner-policy candidate restore"]);
  const restoredCandidate = await waitForHome(candidateHome, "CANDIDATE");
  console.log(`STAGING_ROLLBACK_RESTORED_CANDIDATE ${restoredCandidate}`);

  const receipt = {
    schemaVersion: 1,
    kind: "cloudflare-static-assets-rollback",
    status: "VERIFIED",
    externalDeploymentPerformed: true,
    environment: "staging-worker",
    worker: "strumentini-328-staging-20261015",
    origin: STAGING_ORIGIN,
    currentRevision: revision,
    sourceFingerprint,
    currentDeploymentId: candidate.versionId,
    previousKnownGoodDeploymentId: previous.versionId,
    rollbackCommand: previousRollbackCommand,
    dryRunCommand: "wrangler deploy --dry-run --outdir .wrangler-dry-run",
    rollbackVerified: true,
    observedAt: new Date().toISOString(),
    observations: {
      previousHomeSha256: previousHome,
      candidateHomeSha256: candidateHome,
      restoredPreviousHomeSha256: restoredPrevious,
      restoredCandidateHomeSha256: restoredCandidate,
      candidateBytesDistinctFromPrevious: candidateHome !== previousHome,
    },
    databaseMigration: "NONE",
    reason:
      "Real rollback drill on the isolated staging Worker: previous version served, candidate restored, both verified by home-page bytes. Production assets were not published by this step.",
  };
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`STAGING_ROLLBACK_VERIFIED ${receiptPath}`);
}

await main();
