import { describe, expect, it } from "vitest";
import { validateOwnerRollbackPolicy420 } from "../src/release/owner-policy-420";
import {
  buildStagingRollbackReceipt420,
  STAGING_ROLLBACK_MAX_AGE_MS_420,
} from "../src/release/staging-rollback-observations";

const SHA = "c38da86458eec0512721a5b4abc612b1f7b74a67";
const FINGERPRINT = "a".repeat(64);
const MANIFEST = "d".repeat(64);
const PREVIOUS = "3e4d587a-ee3f-427c-b785-56156357bb45";
const CANDIDATE = "7578d053-899a-4459-b615-1b06b518081d";
const NOW = Date.parse("2026-10-21T18:00:00.000Z");

const observations = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  kind: "cloudflare-staging-rollback-observations",
  observedAt: "2026-10-21T17:50:00.000Z",
  environment: "staging-worker",
  worker: "strumentini-328-staging-20261015",
  origin: "https://strumentini-328-staging-20261015.massafradomenico4.workers.dev",
  previousKnownGoodDeploymentId: PREVIOUS,
  currentDeploymentId: CANDIDATE,
  rollbackCommand: `wrangler rollback ${PREVIOUS} --config worker/wrangler.staging.jsonc`,
  databaseMigration: "NONE",
  distManifestSha256: MANIFEST,
  observations: {
    previousHomeSha256: "e".repeat(64),
    candidateHomeSha256: "f".repeat(64),
    restoredPreviousHomeSha256: "e".repeat(64),
    restoredCandidateHomeSha256: "f".repeat(64),
    candidateBytesDistinctFromPrevious: true,
  },
  ...overrides,
});

const build = (input: Record<string, unknown>, now = NOW) =>
  buildStagingRollbackReceipt420({
    observations: input,
    revision: SHA,
    sourceFingerprint: FINGERPRINT,
    distManifestSha256: MANIFEST,
    now,
  });

describe("STR-405 staging rollback observations", () => {
  it("turns a real drill observation into a receipt the release gate accepts", () => {
    const receipt = build(observations());
    const findings = validateOwnerRollbackPolicy420({
      receipt,
      path: "quality/receipts/release/rollback.json",
      revision: SHA,
      sourceFingerprint: FINGERPRINT,
    });
    expect(findings).toEqual([]);
  });

  it("refuses a drill whose previous and candidate versions are the same deployment", () => {
    expect(() => build(observations({ currentDeploymentId: PREVIOUS }))).toThrow(/STAGING_ROLLBACK_VERSIONS/u);
  });

  it("refuses a rollback command that does not target the previous version", () => {
    expect(() => build(observations({
      rollbackCommand: `wrangler rollback ${CANDIDATE} --config worker/wrangler.staging.jsonc`,
    }))).toThrow(/STAGING_ROLLBACK_VERSIONS/u);
  });

  it("refuses restored bytes that do not match what was served before and after the rollback", () => {
    const restored = observations({
      observations: {
        previousHomeSha256: "e".repeat(64),
        candidateHomeSha256: "f".repeat(64),
        restoredPreviousHomeSha256: "1".repeat(64),
        restoredCandidateHomeSha256: "f".repeat(64),
        candidateBytesDistinctFromPrevious: true,
      },
    });
    expect(() => build(restored)).toThrow(/STAGING_ROLLBACK_RESTORE_UNPROVEN/u);
  });

  it("refuses a drill that published different compiled assets than this source", () => {
    expect(() => buildStagingRollbackReceipt420({
      observations: observations(),
      revision: SHA,
      sourceFingerprint: FINGERPRINT,
      distManifestSha256: "9".repeat(64),
      now: NOW,
    })).toThrow(/STAGING_ROLLBACK_DIST_MISMATCH/u);
  });

  it("refuses a stale or future observation instead of promoting it", () => {
    expect(() => build(observations({ observedAt: "2026-10-21T09:00:00.000Z" }))).toThrow(/STAGING_ROLLBACK_TIMESTAMP/u);
    expect(() => build(observations(), Date.parse("2026-10-21T17:40:00.000Z"))).toThrow(/STAGING_ROLLBACK_TIMESTAMP/u);
    const fresh = Date.parse("2026-10-21T17:50:00.000Z") + STAGING_ROLLBACK_MAX_AGE_MS_420 - 1000;
    expect(() => build(observations(), fresh)).not.toThrow();
  });

  it("refuses a receipt produced outside the isolated staging Worker", () => {
    expect(() => build(observations({ worker: "strumentini" }))).toThrow(/STAGING_ROLLBACK_UNVERIFIED/u);
    expect(() => build(observations({ databaseMigration: "APPLIED" }))).toThrow(/STAGING_ROLLBACK_UNVERIFIED/u);
  });
});
