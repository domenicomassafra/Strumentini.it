import type { ReleaseFinding } from "./validation";

/**
 * #556 coordinator decision (3 November 2026).
 *
 * A real staging rollback already proves that the published bytes can be
 * restored. When a later release compiles the *same* site bytes, re-drilling
 * would only re-deploy an identical candidate: the drill itself refuses that
 * (`STAGING_ROLLBACK_CANDIDATE_BYTES_IDENTICAL`). Such a release may reuse the
 * proven receipt, bound to the compiled dist content hash instead of the git
 * SHA, provided the receipt records that hash and both revisions are recorded
 * here. Any byte difference keeps the requirement for a fresh real rollback.
 */
export const ROLLBACK_REUSE_420_KIND = "dist-content-identical-rollback-reuse-420";

const HEX64 = /^[a-f0-9]{64}$/u;

export interface RollbackReuse420Input {
  readonly receipt: unknown;
  readonly revision: string;
  readonly distManifestSha256: string;
  readonly receiptPath: string;
}

export interface RollbackReuse420Record {
  readonly kind: typeof ROLLBACK_REUSE_420_KIND;
  readonly accepted: true;
  readonly candidateRevision: string;
  readonly provenRevision: string;
  readonly provenSourceFingerprint: string | null;
  readonly distManifestSha256: string;
  readonly originalReceiptPath: string;
  readonly reason: string;
}

export interface RollbackReuse420Assessment {
  readonly reused: boolean;
  readonly record: RollbackReuse420Record | null;
  readonly finding: ReleaseFinding | null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function assessRollbackReuse420(input: RollbackReuse420Input): RollbackReuse420Assessment {
  const blocked = (code: string, message: string): RollbackReuse420Assessment => ({
    reused: false,
    record: null,
    finding: { code, severity: "blocker", message, path: input.receiptPath },
  });
  const receipt = asRecord(input.receipt);
  // A missing, unproven or malformed receipt is judged by the existing validators.
  if (receipt === undefined || receipt.status !== "VERIFIED") {
    return { reused: false, record: null, finding: null };
  }
  const provenRevision = asString(receipt.currentRevision);
  if (provenRevision === undefined) return { reused: false, record: null, finding: null };
  // The receipt already belongs to this source: nothing to reuse.
  if (provenRevision === input.revision) return { reused: false, record: null, finding: null };

  if (!HEX64.test(input.distManifestSha256)) {
    return blocked("ROLLBACK_MANIFEST_UNREADABLE", "compiled dist manifest is not a sha256 digest; a fresh staging rollback is required");
  }
  const provenManifest = asString(receipt.distManifestSha256);
  if (provenManifest === undefined || !HEX64.test(provenManifest)) {
    return blocked(
      "ROLLBACK_RESTORE_REQUIRED",
      "the verified rollback receipt does not record the compiled dist manifest, so a byte-identical release cannot reuse it: run a fresh staging rollback",
    );
  }
  if (provenManifest !== input.distManifestSha256) {
    return blocked(
      "ROLLBACK_RESTORE_REQUIRED",
      "the compiled dist differs from the source of the verified rollback receipt: a fresh staging rollback is required",
    );
  }
  return {
    reused: true,
    finding: null,
    record: {
      kind: ROLLBACK_REUSE_420_KIND,
      accepted: true,
      candidateRevision: input.revision,
      provenRevision,
      provenSourceFingerprint: asString(receipt.sourceFingerprint) ?? null,
      distManifestSha256: input.distManifestSha256,
      originalReceiptPath: input.receiptPath,
      reason:
        "the compiled site of this release is byte-identical to the source whose real staging rollback was verified; "
        + "the gate reuses that receipt bound to the dist content hash instead of the git revision",
    },
  };
}
