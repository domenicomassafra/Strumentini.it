import { describe, expect, it } from "vitest";
import { verifyGeneratedArtifact } from "../src/runtime/artifact-verifier";
import { evaluateFormatClaimEvidence } from "../src/quality/format-evidence";
import type { FormatOperationRow } from "../src/quality/format-operations";

const pngRow: FormatOperationRow = {
  id: "compress-png-lossless",
  source: "fixture",
  operation: "compress",
  inputFormats: ["image/png"],
  outputFormats: ["image/png"],
  priority: "high",
  state: "IMPLEMENT",
  fidelity: "lossless PNG",
  evidence: "fixture",
};

const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

async function verifiedPng() {
  return verifyGeneratedArtifact({
    kind: "image",
    name: "result.png",
    declaredMime: "image/png",
    bytes: png,
    fidelity: {
      fidelity: "lossless",
      statement: "Pixel values are preserved.",
      limitations: ["Ancillary metadata may be removed."],
    },
    reopen: () => ({
      ok: true,
      method: "independent PNG parser",
      facts: { width: 1, height: 1 },
    }),
  });
}

describe("format fidelity and claim evidence", () => {
  it("derives before/after and target-size truth from final verified bytes", async () => {
    const verification = await verifiedPng();
    const result = evaluateFormatClaimEvidence(pngRow, {
      operationId: pngRow.id,
      beforeBytes: 100,
      targetBytes: 20,
      verification,
    });
    expect(result.ok).toBe(true);
    expect(result.record).toMatchObject({
      beforeBytes: 100,
      afterBytes: png.byteLength,
      deltaBytes: png.byteLength - 100,
      target: { bytes: 20, met: false },
      measuredMime: "image/png",
      signature: "89504E470D0A1A0A",
      reopen: { method: "independent PNG parser", facts: { width: 1, height: 1 } },
    });
    expect(result.record?.limitations).toEqual(["Ancillary metadata may be removed."]);
  });

  it("rejects evidence for a SPIKE/REFUSE row even if artifact bytes are valid", async () => {
    const verification = await verifiedPng();
    const spike = { ...pngRow, state: "SPIKE" as const, ticket: "ticket", evidence: undefined };
    expect(evaluateFormatClaimEvidence(spike, {
      operationId: spike.id,
      beforeBytes: 100,
      verification,
    }).issues).toContain("Only IMPLEMENT rows can be satisfied by implementation evidence.");
  });

  it("rejects a mismatched operation id or measured output type", async () => {
    const verification = await verifiedPng();
    const wrongOutput = { ...pngRow, outputFormats: ["image/jpeg"] };
    const result = evaluateFormatClaimEvidence(wrongOutput, {
      operationId: "forged-id",
      beforeBytes: 100,
      verification,
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("Evidence operation id does not match the format-operation row.");
    expect(result.issues).toContain("Measured MIME is not one of the operation row output formats.");
  });

  it("rejects missing independent reopen evidence instead of treating signature alone as implementation proof", async () => {
    const verification = await verifyGeneratedArtifact({
      kind: "image",
      name: "result.png",
      declaredMime: "image/png",
      bytes: png,
      fidelity: { fidelity: "lossless", statement: "Pixel values are preserved." },
    });
    const result = evaluateFormatClaimEvidence(pngRow, {
      operationId: pngRow.id,
      beforeBytes: 100,
      verification,
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("Independent reopen/parse proof is required and must pass.");
  });
});
