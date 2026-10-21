/**
 * STR-405: the Cloudflare session that can deploy or roll back the staging
 * Worker lives on the owner workstation, while the release build, its source
 * fingerprint and the release receipt stay on the build host. This module turns
 * a machine-readable observation of the real drill into the receipt the
 * release gate requires, and refuses anything that was not actually observed:
 * the previous and the candidate version must differ, the rollback must have
 * served the previous bytes, the restore must have served the candidate bytes
 * again, and the observation must describe the compiled assets of this source.
 */
export const STAGING_ROLLBACK_WORKER_420 = "strumentini-328-staging-20261015";
export const STAGING_ROLLBACK_ORIGIN_420 =
  "https://strumentini-328-staging-20261015.massafradomenico4.workers.dev";
/** Eight hours: a drill older than the release evidence window is not current. */
export const STAGING_ROLLBACK_MAX_AGE_MS_420 = 8 * 60 * 60 * 1000;
const hex64 = /^[a-f0-9]{64}$/u;
const versionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;
function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}
export interface StagingRollbackReceiptInput {
  readonly observations: unknown;
  readonly revision: string;
  readonly sourceFingerprint: string;
  /** Manifest digest recomputed from this checkout's compiled dist. */
  readonly distManifestSha256: string;
  readonly now: number;
}
export function buildStagingRollbackReceipt420(input: StagingRollbackReceiptInput): Record<string, unknown> {
  const observations = asRecord(input.observations);
  if (observations === undefined) fail("STAGING_ROLLBACK_OBSERVATION_INVALID", "observation file is not an object");
  if (observations.schemaVersion !== 1 || observations.kind !== "cloudflare-staging-rollback-observations") {
    fail("STAGING_ROLLBACK_OBSERVATION_INVALID", "unexpected schema or kind");
  }
  if (observations.environment !== "staging-worker" ||
      observations.worker !== STAGING_ROLLBACK_WORKER_420 ||
      observations.origin !== STAGING_ROLLBACK_ORIGIN_420 ||
      observations.databaseMigration !== "NONE") {
    fail("STAGING_ROLLBACK_UNVERIFIED", "observation does not describe the isolated staging Worker");
  }
  const previous = asString(observations.previousKnownGoodDeploymentId);
  const candidate = asString(observations.currentDeploymentId);
  if (previous === undefined || candidate === undefined ||
      !versionId.test(previous) || !versionId.test(candidate) || previous === candidate) {
    fail("STAGING_ROLLBACK_VERSIONS", "previous and candidate versions are not two distinct deployments");
  }
  if (observations.rollbackCommand !== `wrangler rollback ${previous} --config worker/wrangler.staging.jsonc`) {
    fail("STAGING_ROLLBACK_VERSIONS", "rollback command does not target the previous version");
  }
  const observedAt = asString(observations.observedAt);
  const observedMs = Date.parse(observedAt ?? "");
  if (observedAt === undefined || !Number.isFinite(observedMs) || observedMs > input.now + 300_000 ||
      input.now - observedMs > STAGING_ROLLBACK_MAX_AGE_MS_420) {
    fail("STAGING_ROLLBACK_TIMESTAMP", "observation time is missing, in the future or stale");
  }
  const manifest = asString(observations.distManifestSha256);
  if (!hex64.test(manifest ?? "") || manifest !== input.distManifestSha256) {
    fail("STAGING_ROLLBACK_DIST_MISMATCH", "drill did not publish the compiled assets of this source");
  }
  const hashes = asRecord(observations.observations);
  const before = asString(hashes?.previousHomeSha256);
  const after = asString(hashes?.candidateHomeSha256);
  const restoredPrevious = asString(hashes?.restoredPreviousHomeSha256);
  const restoredCandidate = asString(hashes?.restoredCandidateHomeSha256);
  if (!hex64.test(before ?? "") || !hex64.test(after ?? "") || before === after ||
      hashes?.candidateBytesDistinctFromPrevious !== true) {
    fail("STAGING_ROLLBACK_RESTORE_UNPROVEN", "candidate and previous bytes were not observed as distinct");
  }
  if (before !== restoredPrevious || after !== restoredCandidate) {
    fail("STAGING_ROLLBACK_RESTORE_UNPROVEN", "rollback or candidate restore did not serve the recorded bytes");
  }
  return {
    schemaVersion: 1,
    kind: "cloudflare-static-assets-rollback",
    status: "VERIFIED",
    externalDeploymentPerformed: true,
    environment: "staging-worker",
    worker: STAGING_ROLLBACK_WORKER_420,
    origin: STAGING_ROLLBACK_ORIGIN_420,
    currentRevision: input.revision,
    sourceFingerprint: input.sourceFingerprint,
    currentDeploymentId: candidate,
    previousKnownGoodDeploymentId: previous,
    rollbackCommand: observations.rollbackCommand,
    dryRunCommand: "wrangler deploy --dry-run --outdir .wrangler-dry-run",
    rollbackVerified: true,
    observedAt,
    observations: {
      previousHomeSha256: before,
      candidateHomeSha256: after,
      restoredPreviousHomeSha256: restoredPrevious,
      restoredCandidateHomeSha256: restoredCandidate,
      candidateBytesDistinctFromPrevious: true,
    },
    databaseMigration: "NONE",
    reason:
      "Real rollback drill on the isolated staging Worker: previous version served, candidate restored, both verified " +
      "byte for byte; no production Worker or D1 was touched.",
  };
}
