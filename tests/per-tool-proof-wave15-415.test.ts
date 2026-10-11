import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { probeReceipt415 } from "../scripts/audit-per-tool-proof-415";

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const revision = "b".repeat(40);
const fingerprint = "a".repeat(64);
const toolId = "business-day";
const currentManifestSha256 = sha("exact current business-day manifest bytes");
const receipt = JSON.stringify({
  toolId, schemaVersion: 1, status: "GOLD", goldEligible: true,
  revision, sourceFingerprint: fingerprint,
  oracleEntryId: "cand-083", fixtureFamilies: ["business-days"],
  runtime: { location: "LOCAL", network: "forbidden" },
  identities: { manifestSha256: currentManifestSha256 },
});
const valid = {
  toolId, path: "quality/receipts/business-day.gold.json",
  content: receipt, expectedSha256: sha(receipt),
  fingerprint, revision, currentManifestSha256,
};

describe("#415 wave15 independent per-route receipt provenance", () => {
  it("accepts matching tool-owned receipt path but refuses a different tool's filename despite valid SHA, revision and manifest", () => {
    // RED against wave13: the regex checks a plausible path but never binds
    // the leaf receipt filename to the claimed toolId. A copied receipt with
    // internally valid bytes can masquerade as proof for a different file.
    expect(probeReceipt415(valid)).toBe(true);
    expect(probeReceipt415({
      ...valid, path: "quality/receipts/table-ops/csv-dedupe.gold.json",
    })).toBe(false);
    expect(probeReceipt415({
      ...valid, path: "quality/receipts/business-day/another-tool.gold.json",
    })).toBe(false);
  });

  it("allows registered family grouping without turning arbitrary receipt leaf into current proof", () => {
    expect(probeReceipt415({
      ...valid, path: "quality/receipts/date-time/business-day.gold.json",
    })).toBe(true);
    expect(probeReceipt415({
      ...valid, path: "quality/receipts/date-time/business-day.gold.json.bak",
    })).toBe(false);
    expect(probeReceipt415({
      ...valid, path: "quality/receipts/date-time/Business-Day.gold.json",
    })).toBe(false);
  });
});
