import { describe, expect, it } from "vitest";
import { calculateNationalGrossIrpef127 } from "../src/engines/italy/irpef-national-127";
import {
  ANNUAL_SOURCE_CHANGE_LOG_117,
  assertAnnualSourceChangeLog117,
  auditAnnualSourceChangeLog117,
} from "../src/reference-data/italy/annual-source-changelog-117";
import {
  ANNUAL_FISCAL_REVIEW_OWNER_117,
  getAnnualFiscalSourceRows117,
} from "../src/reference-data/italy/annual-source-registry-117";

describe("STR-409 official annual source acceptance", () => {
  it("retains dated and sourced 2024–2026 history under AGENT_PROCESS", () => {
    expect(ANNUAL_FISCAL_REVIEW_OWNER_117.kind).toBe("AGENT_PROCESS");
    expect(ANNUAL_FISCAL_REVIEW_OWNER_117.professionalApproval).toBe("NOT_ATTESTED");
    expect(ANNUAL_SOURCE_CHANGE_LOG_117).toHaveLength(5);
    expect([...new Set(ANNUAL_SOURCE_CHANGE_LOG_117.map((row) => row.taxYear))].sort()).toEqual([2024, 2025, 2026]);
    for (const row of ANNUAL_SOURCE_CHANGE_LOG_117) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(row.sourceOwnerId).toBe(ANNUAL_FISCAL_REVIEW_OWNER_117.ownerId);
      expect(row.sourceUrls.every((url) => url.startsWith("https://"))).toBe(true);
      expect(row.sourceHashes.every((hash) => /^sha256:[a-f0-9]{64}$/u.test(hash))).toBe(true);
    }
  });

  it("keeps prior annual results and inputs intact at the Jan 1 rollover", () => {
    const input = Object.freeze({ taxableCents: 4_000_000 });
    const historical = calculateNationalGrossIrpef127(2025, input.taxableCents);
    const current = calculateNationalGrossIrpef127(2026, input.taxableCents);
    expect(historical.grossNationalTaxCents).toBe(1_064_000);
    expect(current.grossNationalTaxCents).toBe(1_040_000);
    expect(historical.ruleRevisionId).toBe("IRPEF-2025-117-v1");
    expect(current.ruleRevisionId).toBe("IRPEF-2026-117-v1");
    expect(input).toEqual({ taxableCents: 4_000_000 });
    expect(getAnnualFiscalSourceRows117(2027)).toEqual([]);
    expect(() => calculateNationalGrossIrpef127(2027, input.taxableCents))
      .toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    const rollover = auditAnnualSourceChangeLog117("2027-01-01");
    expect(rollover.ok).toBe(false);
    expect(rollover.notRunYears).toEqual([2027]);
    expect(rollover.yearOutcomes.find((row) => row.taxYear === 2027)?.outcome).toBe("NOT_RUN");
    expect(calculateNationalGrossIrpef127(2025, input.taxableCents)).toEqual(historical);
  });

  it("makes a new retrospective version visible only after its verified date", () => {
    const base = ANNUAL_SOURCE_CHANGE_LOG_117.find((row) =>
      row.entryId === "national-irpef-gross-subset:2025:IRPEF-2025-117-v1");
    expect(base).toBeDefined();
    const amendment = {
      ...base!,
      entryId: "national-irpef-gross-subset:2025:TEST-2025-v2",
      version: "TEST-2025-v2",
      checkedAt: "2026-10-22",
      amendmentKind: "RETROACTIVE_AMENDMENT" as const,
      supersedesRevisionId: "IRPEF-2025-117-v1",
      reviewOwner: "TEST-REVIEWER-ONLY",
      sourceHashes: ["sha256:" + "b".repeat(64)],
    };
    const original = JSON.stringify(ANNUAL_SOURCE_CHANGE_LOG_117);
    const log = assertAnnualSourceChangeLog117([...ANNUAL_SOURCE_CHANGE_LOG_117, amendment]);
    expect(auditAnnualSourceChangeLog117("2026-10-21", log).retroactiveAmendments).toEqual([]);
    expect(auditAnnualSourceChangeLog117("2026-10-22", log).retroactiveAmendments)
      .toEqual([amendment.entryId]);
    expect(log.at(-1)?.supersedesRevisionId).toBe("IRPEF-2025-117-v1");
    expect(Object.isFrozen(log.at(-1)?.sourceHashes)).toBe(true);
    expect(Object.isFrozen(log.at(-1)?.sourceUrls)).toBe(true);
    expect(JSON.stringify(ANNUAL_SOURCE_CHANGE_LOG_117)).toBe(original);
  });

  it("keeps an unreleased future annual baseline outside today's audit", () => {
    const base = ANNUAL_SOURCE_CHANGE_LOG_117.find((row) =>
      row.entryId === "national-irpef-gross-subset:2026:IRPEF-2026-117-v1");
    expect(base).toBeDefined();
    const future = {
      ...base!, entryId: "national-irpef-gross-subset:2027:TEST-2027-v1",
      taxYear: 2027, version: "TEST-2027-v1", checkedAt: "2027-01-02",
      effectiveFrom: "2027-01-01", effectiveTo: "2027-12-31",
    };
    const log = assertAnnualSourceChangeLog117([...ANNUAL_SOURCE_CHANGE_LOG_117, future]);
    expect(auditAnnualSourceChangeLog117("2026-10-21", log).ok).toBe(true);
    expect(auditAnnualSourceChangeLog117("2027-01-01", log).notRunYears).toContain(2027);
    expect(auditAnnualSourceChangeLog117("2027-01-02", log).ok).toBe(true);
  });
});
