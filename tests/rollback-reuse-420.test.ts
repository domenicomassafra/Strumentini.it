import { describe, expect, it } from "vitest";
import { assessRollbackReuse420 } from "../src/release/rollback-reuse-420";

const PROVEN = "a".repeat(40);
const CANDIDATE = "b".repeat(40);
const MANIFEST = "1".repeat(64);
const OTHER_MANIFEST = "2".repeat(64);
const RECEIPT_PATH = "quality/receipts/release/rollback.json";

const verifiedReceipt = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  kind: "cloudflare-static-assets-rollback",
  status: "VERIFIED",
  rollbackVerified: true,
  currentRevision: PROVEN,
  sourceFingerprint: "c".repeat(64),
  distManifestSha256: MANIFEST,
  currentDeploymentId: "5165b437-af62-4722-ad4c-67d6acb1f8a6",
  previousKnownGoodDeploymentId: "517ec5a1-4c46-4a72-8c3e-3b647a8c2d3f",
  ...overrides,
});

const assess = (receipt: unknown, distManifestSha256 = MANIFEST) =>
  assessRollbackReuse420({ receipt, revision: CANDIDATE, distManifestSha256, receiptPath: RECEIPT_PATH });

describe("#556 rollback reuse for a byte-identical release", () => {
  it("reuses a verified rollback when the compiled dist content hash matches", () => {
    const assessment = assess(verifiedReceipt());
    expect(assessment.reused).toBe(true);
    expect(assessment.finding).toBeNull();
    expect(assessment.record).toMatchObject({
      accepted: true,
      candidateRevision: CANDIDATE,
      provenRevision: PROVEN,
      distManifestSha256: MANIFEST,
      originalReceiptPath: RECEIPT_PATH,
    });
  });

  it("requires a fresh rollback as soon as one dist byte changes", () => {
    const assessment = assess(verifiedReceipt(), OTHER_MANIFEST);
    expect(assessment.reused).toBe(false);
    expect(assessment.record).toBeNull();
    expect(assessment.finding).toMatchObject({ code: "ROLLBACK_RESTORE_REQUIRED", severity: "blocker" });
  });

  it("refuses to reuse a receipt that does not record the compiled dist manifest", () => {
    const legacy = verifiedReceipt();
    delete (legacy as { distManifestSha256?: string }).distManifestSha256;
    const assessment = assess(legacy);
    expect(assessment.reused).toBe(false);
    expect(assessment.finding).toMatchObject({ code: "ROLLBACK_RESTORE_REQUIRED" });
  });

  it("leaves the fresh path untouched when the receipt already belongs to this revision", () => {
    const assessment = assess(verifiedReceipt({ currentRevision: CANDIDATE }), OTHER_MANIFEST);
    expect(assessment.reused).toBe(false);
    expect(assessment.finding).toBeNull();
  });

  it("does not judge unproven or missing receipts that the existing validators own", () => {
    expect(assess(undefined).finding).toBeNull();
    expect(assess(verifiedReceipt({ status: "UNPROVEN" })).finding).toBeNull();
  });
});
