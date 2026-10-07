import type { GeneratedArtifactVerificationResult } from "../runtime/artifact-verifier";
import type { FormatOperationRow } from "./format-operations";

export interface FormatClaimEvidenceInput {
  readonly operationId: string;
  readonly beforeBytes: number;
  readonly verification: GeneratedArtifactVerificationResult;
  readonly targetBytes?: number;
}

export interface FormatClaimEvidenceRecord {
  readonly operationId: string;
  readonly measuredMime: string;
  readonly signature: string;
  readonly fidelity: {
    readonly mode: "lossless" | "lossy" | "structural" | "unknown";
    readonly statement: string;
  };
  readonly beforeBytes: number;
  readonly afterBytes: number;
  readonly deltaBytes: number;
  readonly sizeRatio: number | null;
  readonly target?: {
    readonly bytes: number;
    readonly met: boolean;
  };
  readonly reopen: {
    readonly method: string;
    readonly facts: Readonly<Record<string, string | number | boolean>>;
  };
  readonly limitations: readonly string[];
}

export interface FormatEvidenceEvaluation {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly record?: FormatClaimEvidenceRecord;
}

function byteCount(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(label + " must be a non-negative integer");
  return value;
}

function outputAcceptsMime(row: FormatOperationRow, mime: string): boolean {
  const concreteMimeOutputs = row.outputFormats.filter((format) => format.includes("/"));
  if (concreteMimeOutputs.length === 0) return true;
  return concreteMimeOutputs.includes(mime)
    || concreteMimeOutputs.some((format) => format.endsWith("/*") && mime.startsWith(format.slice(0, -1)));
}

export function evaluateFormatClaimEvidence(
  row: FormatOperationRow,
  input: FormatClaimEvidenceInput,
): FormatEvidenceEvaluation {
  const issues: string[] = [];
  if (input.operationId !== row.id) issues.push("Evidence operation id does not match the format-operation row.");

  const beforeBytes = byteCount(input.beforeBytes, "beforeBytes");
  const targetBytes = input.targetBytes === undefined ? undefined : byteCount(input.targetBytes, "targetBytes");
  const verification = input.verification;
  const artifact = verification.artifact;
  const measuredMime = verification.measured.mime;
  const signature = verification.measured.signature;

  if (row.state !== "IMPLEMENT") {
    issues.push("Only IMPLEMENT rows can be satisfied by implementation evidence.");
  }
  if (!verification.success || !artifact.download.ready || artifact.verification.state !== "verified") {
    issues.push("Generated artifact did not pass measured signature/type verification.");
  }
  if (measuredMime === null || signature === null) {
    issues.push("Measured MIME and signature are required.");
  } else if (!outputAcceptsMime(row, measuredMime)) {
    issues.push("Measured MIME is not one of the operation row output formats.");
  }
  if (artifact.byteLength !== artifact.bytes.byteLength) {
    issues.push("Artifact byte length is not derived from the authoritative byte payload.");
  }
  if (verification.reopen === undefined || !verification.reopen.ok) {
    issues.push("Independent reopen/parse proof is required and must pass.");
  }
  if (artifact.fidelityNote.trim() === "") {
    issues.push("A fidelity/loss statement is required.");
  }

  if (issues.length > 0 || measuredMime === null || signature === null || verification.reopen === undefined) {
    return { ok: false, issues };
  }

  const afterBytes = artifact.byteLength;
  const limitations = artifact.fidelityNote
    .split("Limitazione:")
    .slice(1)
    .map((value) => value.trim())
    .filter(Boolean);
  const statement = artifact.fidelityNote.split("Limitazione:", 1)[0]?.trim() ?? artifact.fidelityNote.trim();

  const record: FormatClaimEvidenceRecord = {
    operationId: row.id,
    measuredMime,
    signature,
    fidelity: {
      mode: artifact.fidelity,
      statement,
    },
    beforeBytes,
    afterBytes,
    deltaBytes: afterBytes - beforeBytes,
    sizeRatio: beforeBytes === 0 ? null : afterBytes / beforeBytes,
    ...(targetBytes === undefined ? {} : { target: { bytes: targetBytes, met: afterBytes <= targetBytes } }),
    reopen: {
      method: verification.reopen.method,
      facts: verification.reopen.facts ?? {},
    },
    limitations,
  };
  return { ok: true, issues: [], record };
}
