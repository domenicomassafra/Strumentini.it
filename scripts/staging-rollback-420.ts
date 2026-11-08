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
 * Production artifact mode (guarded publisher only):
 *   --release-artifact          deploy the already built PRODUCTION dist to the
 *                               isolated staging Worker, prove rollback and
 *                               candidate restore, then restore staging to its
 *                               previous version before writing the receipt.
 *
 * Usage: tsx scripts/staging-rollback-420.ts --receipt=quality/receipts/release/rollback.json
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStagingRollbackReceipt420, STAGING_ROLLBACK_ORIGIN_420 } from "../src/release/staging-rollback-observations";
import { currentEvidenceSourceFingerprint } from "./lib/current-revision";
import { inspectReleaseWorkingTree162 } from "./lib/release-evidence-worktree-162";
import {
  STAGING_PUBLIC_TURNSTILE_KEY,
  assertStagingConfig,
  assertStagingHtml,
} from "./deploy-staging-328";
import { fingerprintPublicationAssets404 } from "./prepublish-404";
const ROOT = resolve(import.meta.dirname, "..");
const STAGING_ORIGIN = STAGING_ROLLBACK_ORIGIN_420;
const STAGES_CONFIG = "worker/wrangler.staging.jsonc";
// Only public build-time identifiers are checked here. The release artifact is
// temporarily served by the isolated staging Worker and then rolled back to
// its previous staging version before the production gate can accept it.
const PRODUCTION_ORIGIN = "https://strumentini.it";
const PRODUCTION_TURNSTILE_SITE_KEY = "0x4AAAAAAFMra1fmqLYks6Ct";
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
  const dirty = inspectReleaseWorkingTree162(ROOT).dirty;
  if (dirty) throw new Error("STAGING_ROLLBACK_DIRTY_WORKTREE");
  return { revision, sourceFingerprint: currentEvidenceSourceFingerprint(ROOT) };
}
/** Deploy-only publisher: the dist was compiled on the build host and copied
 * here byte for byte, so this path never runs a build. */
export function assertProductionReleaseHtml420(source: string): void {
  const keys = [...source.matchAll(/data-turnstile-site-key="([^"]+)"/gu)].map((item) => item[1]);
  if (keys.length === 0 || keys.some((key) => key !== PRODUCTION_TURNSTILE_SITE_KEY) ||
      !source.includes(PRODUCTION_ORIGIN) || source.includes(STAGING_ORIGIN)) {
    throw new Error("STAGING_RELEASE_ARTIFACT_NOT_PRODUCTION_HTML");
  }
}
function deployPrebuiltStaging(releaseArtifact = false): void {
  assertStagingConfig(readFileSync(resolve(ROOT, STAGES_CONFIG), "utf8"));
  const html = readFileSync(resolve(ROOT, "dist/accedi/index.html"), "utf8");
  if (releaseArtifact) assertProductionReleaseHtml420(html);
  else assertStagingHtml(html);
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
async function writeObservations(path: string, releaseArtifact = false): Promise<void> {
  const distManifestSha256 = await fingerprintPublicationAssets404(resolve(ROOT, "dist"));
  const previous = currentVersion();
  const previousHome = await homeHash();
  console.log(`STAGING_ROLLBACK_PREVIOUS ${previous.versionId} ${previousHome}`);
  let observations: Record<string, unknown> | undefined;
  let attemptedDeployment = false;
  try {
    attemptedDeployment = true;
    deployPrebuiltStaging(releaseArtifact);
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
    if (await fingerprintPublicationAssets404(resolve(ROOT, "dist")) !== distManifestSha256) {
      throw new Error("STAGING_ROLLBACK_DIST_CHANGED_DURING_PROOF");
    }
    observations = {
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
  } finally {
    if (releaseArtifact && attemptedDeployment) {
      // The proof's production HTML must not remain on the staging origin.
      if (currentVersion().versionId !== previous.versionId) {
        wranglerRun(["rollback", previous.versionId, "--message", "STR-520 restore isolated staging after proof"]);
      }
      await waitForHome(previousHome, "STAGING_FINAL");
      console.log(`STAGING_RELEASE_ARTIFACT_STAGING_RESTORED ${previous.versionId}`);
    }
  }
  if (observations === undefined) throw new Error("STAGING_ROLLBACK_OBSERVATIONS_MISSING");
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
  const releaseArtifact = process.argv.includes("--release-artifact");
  if (releaseArtifact && (observationsOut !== undefined || observationsIn !== undefined ||
      process.argv.slice(2).some((item) => item !== "--release-artifact" && !item.startsWith("--receipt=")))) {
    throw new Error("STAGING_ROLLBACK_RELEASE_ARTIFACT_MODE_CONFLICT");
  }
  if (observationsOut !== undefined && observationsIn !== undefined) {
    throw new Error("STAGING_ROLLBACK_MODE_CONFLICT");
  }
  if (releaseArtifact) {
    assertClean();
    const observationPath = "quality/receipts/release/production-artifact-observations.json";
    await writeObservations(observationPath, true);
    await writeReceiptFromObservations(observationPath, receiptPath);
    return;
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
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
