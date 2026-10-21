import { describe, expect, it } from "vitest";
import type { AnnualSourceChangeEntry117 } from "../src/reference-data/italy/annual-source-changelog-117";
import {
  ANNUAL_SOURCE_CHANGE_LOG_117,
  assertAnnualSourceChangeLog117,
} from "../src/reference-data/italy/annual-source-changelog-117";

const original = () => {
  const found = ANNUAL_SOURCE_CHANGE_LOG_117.find((row) =>
    row.entryId === "national-irpef-gross-subset:2025:IRPEF-2025-117-v1");
  if (!found) throw new Error("Missing source revision");
  return found;
};

const simulated = () => ({
  ...original(),
  entryId: "national-irpef-gross-subset:2025:TEST-2025-v2",
  version: "TEST-2025-v2",
  checkedAt: "2026-10-22",
  amendmentKind: "RETROACTIVE_AMENDMENT" as const,
  supersedesRevisionId: "IRPEF-2025-117-v1",
  reviewOwner: "TEST-REVIEWER-ONLY",
  sourceHashes: ["sha256:" + "b".repeat(64)],
});

describe("STR-409 retrospective amendments refuse silent rewrite", () => {
  it("rejects forged revision identity instead of accepting an untraceable row", () => {
    expect(() => assertAnnualSourceChangeLog117([...ANNUAL_SOURCE_CHANGE_LOG_117, {
      ...simulated(), entryId: "national-irpef-gross-subset:2025:IRPEF-2025-117-v1-forged",
    }])).toThrow(/INVALID_ID/u);
    expect(() => assertAnnualSourceChangeLog117([...ANNUAL_SOURCE_CHANGE_LOG_117, {
      ...simulated(), datasetId: "other-dataset",
    }])).toThrow(/INVALID_ID/u);
  });

  it("rejects unsigned, unsourced and unlinked retroactive changes", () => {
    const bad = (change: Partial<AnnualSourceChangeEntry117>) =>
      assertAnnualSourceChangeLog117([...ANNUAL_SOURCE_CHANGE_LOG_117, { ...simulated(), ...change }]);
    expect(() => bad({ reviewOwner: null })).toThrow(/INVALID_AMENDMENT/u);
    expect(() => bad({ supersedesRevisionId: "unknown" })).toThrow(/INVALID_AMENDMENT/u);
    expect(() => bad({ supersedesRevisionId: null })).toThrow(/INVALID_AMENDMENT/u);
    expect(() => bad({ sourceHashes: original().sourceHashes })).toThrow(/INVALID_AMENDMENT/u);
    expect(() => bad({ sourceUrls: ["https://forged.example/"] })).toThrow(/NOT_OFFICIAL/u);
    expect(() => bad({ checkedAt: "2025-02-30" })).toThrow(/INVALID_DATE/u);
    expect(() => bad({ sourceOwnerId: "unknown" })).toThrow(/UNKNOWN_OWNER/u);
  });

  it("refuses another baseline for the same year and does not mutate the original", () => {
    const serialized = JSON.stringify(ANNUAL_SOURCE_CHANGE_LOG_117);
    expect(() => assertAnnualSourceChangeLog117([...ANNUAL_SOURCE_CHANGE_LOG_117, {
      ...simulated(), amendmentKind: "YEAR_BASELINE", supersedesRevisionId: null,
    }])).toThrow(/INVALID_BASELINE/u);
    expect(JSON.stringify(ANNUAL_SOURCE_CHANGE_LOG_117)).toBe(serialized);
    expect(original().version).toBe("IRPEF-2025-117-v1");
  });
});
