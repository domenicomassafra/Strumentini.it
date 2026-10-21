/**
 * #405 / owner decision 20/10/2026: prove rollback on the isolated staging
 * Worker before production promotion. Never touches the production Worker or D1.
 *
 * Full mode (Cloudflare session and build host are the same machine):
 *   1. record the currently served staging version and its home-page bytes;
 *   2. deploy the candidate from this checkout (staging:deploy:328);
 *   3. roll back to the recorded version and verify the served bytes match;
 *   4. restore the candidate and verify its bytes again;
 *   5. write a VERIFIED rollback receipt bound to this revision/fingerprint.
 *
 * Split mode, when the Cloudflare session lives on the owner workstation and the
 * build must stay on the build host (owner authorization, STR-405 21/10/2026):
 *   --write-observations=<path>  deploy/rollback/restore with the already built
 *                                dist and record only what was observed;
 *   --from-observations=<path>   on the build host, recompute the dist manifest,
 *                                refuse anything inconsistent and write the
 *                                receipt bound to this checkout.
 *
 * Usage: tsx scripts/staging-rollback-420.ts --receipt=quality/receipts/release/rollback.json
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildStagingRollbackReceipt420, STAGING_ROLLBACK_ORIGIN_420 } from "../src/release/staging-rollback-observations";
import { currentEvidenceSourceFingerprint } from "./lib/current-revision";
import {
  STAGING_PUBLIC_TURNSTILE_KEY,
  assertStagingConfig,
  assertStagingHtml,
} from "./deploy-staging-328";
import { fingerprintPublicationAssets404 } from "./prepublish-404";
const ROOT = resolve(import.meta.dirname, "..");
const STAGING_ORIGIN = STAGING_ROLLBACK_ORIGIN_420;
const STAGES_CONFIG = "worker/wrangler.staging.jsonc";
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
function arg(name: string): string | undefined {
  return process.argv.slice(2).find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}
const WRANGLER = resolve(ROOT, "node_modules/.bin/wrangler");
function wrangler(args: readonly string[]): string {
  return execFileSync(WRANGLER, [...args, "--config", STAGES_CONFIG], {
    cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
}
function wranglerRun(args: readonly string[]): void {
  execFileSync(WRANGLER, [...args, "--config", STAGES_CONFIG], { cwd: ROOT, stdio: "inherit" });
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
function assertClean(): { revision: string; sourceFingerprint: Promise<string> } {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim().length > 0;
  if (dirty) throw new Error("STAGING_ROLLBACK_DIRTY_WORKTREE");
  return { revision, sourceFingerprint: currentEvidenceSourceFingerprint(ROOT) };
}
/** Deploy-only publisher: the dist was compiled on the build host and copied
 * here byte for byte, so this path never runs a build. */
function deployPrebuiltStaging(): void {
  assertStagingConfig(readFileSync(resolve(ROOT, STAGES_CONFIG), "utf8"));
  assertStagingHtml(readFileSync(resolve(ROOT, "dist/accedi/index.html"), "utf8"));
  execFileSync(WRANGLER, ["deploy", "--config", STAGES_CONFIG], {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      PUBLIC_SITE_URL: STAGING_ORIGIN,
      PUBLIC_TURNSTILE_SITE_KEY: STAGING_PUBLIC_TURNSTILE_KEY,
    },
  });
}
async function writeObservations(path: string): Promise<void> {
  const distManifestSha256 = await fingerprintPublicationAssets404(resolve(ROOT, "dist"));
  const previous = currentVersion();
  const previousHome = await homeHash();
  console.log(`STAGING_ROLLBACK_PREVIOUS ${previous.versionId} ${previousHome}`);
  deployPrebuiltStaging();
  const candidate = currentVersion();
  if (candidate.versionId === previous.versionId) throw new Error("STAGING_ROLLBACK_CANDIDATE_NOT_NEW");
  let candidateHome = await homeHash();
  for (let attempt = 0; attempt < 20 && candidateHome === previousHome; attempt += 1) {
    await sleep(4000);
    candidateHome = await homeHash();
  }
  if (candidateHome === previousHome) throw new Error("STAGING_ROLLBACK_CANDIDATE_BYTES_IDENTICAL");
  console.log(`STAGING_ROLLBACK_CANDIDATE ${candidate.versionId} ${candidateHome}`);
  const rollbackCommand = `wrangler rollback ${previous.versionId} --config ${STAGES_CONFIG}`;
  wranglerRun(["rollback", previous.versionId, "--message", "STR-405 owner-policy rollback drill"]);
  const restoredPrevious = await waitForHome(previousHome, "PREVIOUS");
  console.log(`STAGING_ROLLBACK_RESTORED_PREVIOUS ${restoredPrevious}`);
  wranglerRun(["rollback", candidate.versionId, "--message", "STR-405 owner-policy candidate restore"]);
  const restoredCandidate = await waitForHome(candidateHome, "CANDIDATE");
  console.log(`STAGING_ROLLBACK_RESTORED_CANDIDATE ${restoredCandidate}`);
  const observations = {
    schemaVersion: 1,
    kind: "cloudflare-staging-rollback-observations",
    observedAt: new Date().toISOString(),
    environment: "staging-worker",
    worker: "strumentini-328-staging-20261015",
    origin: STAGING_ORIGIN,
    previousKnownGoodDeploymentId: previous.versionId,
    currentDeploymentId: candidate.versionId,
    rollbackCommand,
    databaseMigration: "NONE",
    distManifestSha256,
    observations: {
      previousHomeSha256: previousHome,
      candidateHomeSha256: candidateHome,
      restoredPreviousHomeSha256: restoredPrevious,
      restoredCandidateHomeSha256: restoredCandidate,
      candidateBytesDistinctFromPrevious: candidateHome !== previousHome,
    },
  };
  await mkdir(dirname(resolve(ROOT, path)), { recursive: true });
  await writeFile(resolve(ROOT, path), `${JSON.stringify(observations, null, 2)}\n`, "utf8");
  console.log(`STAGING_ROLLBACK_OBSERVED ${path}`);
}
async function writeReceiptFromObservations(observationsPath: string, receiptPath: string): Promise<void> {
  const { revision, sourceFingerprint } = assertClean();
  const observations = JSON.parse(await readFile(resolve(ROOT, observationsPath), "utf8")) as unknown;
  const distManifestSha256 = await fingerprintPublicationAssets404(resolve(ROOT, "dist"));
  const receipt = buildStagingRollbackReceipt420({
    observations,
    revision,
    sourceFingerprint: await sourceFingerprint,
    distManifestSha256,
    now: Date.now(),
  });
  await mkdir(dirname(resolve(ROOT, receiptPath)), { recursive: true });
  await writeFile(resolve(ROOT, receiptPath), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`STAGING_ROLLBACK_VERIFIED ${receiptPath}`);
}
async function main(): Promise<void> {
  const receiptPath = arg("receipt") ?? "quality/receipts/release/rollback.json";
  const observationsOut = arg("write-observations");
  const observationsIn = arg("from-observations");
  if (observationsOut !== undefined && observationsIn !== undefined) {
    throw new Error("STAGING_ROLLBACK_MODE_CONFLICT");
  }
  if (observationsOut !== undefined) {
    await writeObservations(observationsOut);
    return;
  }
  if (observationsIn !== undefined) {
    await writeReceiptFromObservations(observationsIn, receiptPath);
    return;
  }
  const { revision, sourceFingerprint } = assertClean();
  const fingerprint = await sourceFingerprint;
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
  const rollbackCommand = `wrangler rollback ${previous.versionId} --config ${STAGES_CONFIG}`;
  wranglerRun(["rollback", previous.versionId, "--message", "STR-405 owner-policy rollback drill"]);
  const restoredPrevious = await waitForHome(previousHome, "PREVIOUS");
  console.log(`STAGING_ROLLBACK_RESTORED_PREVIOUS ${restoredPrevious}`);
  wranglerRun(["rollback", candidate.versionId, "--message", "STR-405 owner-policy candidate restore"]);
  const restoredCandidate = await waitForHome(candidateHome, "CANDIDATE");
  console.log(`STAGING_ROLLBACK_RESTORED_CANDIDATE ${restoredCandidate}`);
  const distManifestSha256 = await fingerprintPublicationAssets404(resolve(ROOT, "dist"));
  const receipt = buildStagingRollbackReceipt420({
    observations: {
      schemaVersion: 1,
      kind: "cloudflare-staging-rollback-observations",
      observedAt: new Date().toISOString(),
      environment: "staging-worker",
      worker: "strumentini-328-staging-20261015",
      origin: STAGING_ORIGIN,
      previousKnownGoodDeploymentId: previous.versionId,
      currentDeploymentId: candidate.versionId,
      rollbackCommand,
      databaseMigration: "NONE",
      distManifestSha256,
      observations: {
        previousHomeSha256: previousHome,
        candidateHomeSha256: candidateHome,
        restoredPreviousHomeSha256: restoredPrevious,
        restoredCandidateHomeSha256: restoredCandidate,
        candidateBytesDistinctFromPrevious: candidateHome !== previousHome,
      },
    },
    revision,
    sourceFingerprint: fingerprint,
    distManifestSha256,
    now: Date.now(),
  });
  await mkdir(dirname(resolve(ROOT, receiptPath)), { recursive: true });
  await writeFile(resolve(ROOT, receiptPath), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`STAGING_ROLLBACK_VERIFIED ${receiptPath}`);
}
await main();
