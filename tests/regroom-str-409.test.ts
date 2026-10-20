import { describe, expect, it, vi } from "vitest";
import { calculateNationalGrossIrpef127 } from "../src/engines/italy/irpef-national-127";
import { getVerifiedNationalIrpef117, VERIFIED_IRPEF_EXCERPTS_117 } from "../src/reference-data/italy/fiscal-annual-117";
import { diffFiscalBands409, selectFiscalRevision409 } from "../src/reference-data/italy/fiscal-revisions-409";

describe("STR-409 immutable fiscal versions and dated amendments", () => {
  const original = () => getVerifiedNationalIrpef117(2025);
  const simulatedAmendment = () => ({
    ...original(),
    revisionId: "TEST-2025-v2",
    checkedAt: "2026-10-19",
    amendmentKind: "RETROACTIVE_AMENDMENT" as const,
    supersedesRevisionId: "IRPEF-2025-117-v1",
    reviewOwner: "TEST-REVIEWER-ONLY",
    bands: [{ upToCents: 2_800_000, rateBasisPoints: 2300 }, { upToCents: 5_000_000, rateBasisPoints: 3400 },
      { upToCents: null, rateBasisPoints: 4300 }],
    sources: [{ authority: "Normattiva" as const, url: "https://example.invalid/test-amendment", artifactPath: "test-only",
      sha256: `sha256:${"a".repeat(64)}` as const }],
  });

  it("pins source evidence and a unique rule revision to each published annual result", () => {
    expect(VERIFIED_IRPEF_EXCERPTS_117.map((entry) => entry.revisionId)).toEqual([
      "IRPEF-2025-117-v1", "IRPEF-2026-117-v1",
    ]);
    for (const entry of VERIFIED_IRPEF_EXCERPTS_117) {
      expect(entry.reviewOwner).toBeNull(); // Independent fiscal owner has not signed the annual review.
      expect(entry.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(entry.sources.every((source) => /^sha256:[a-f0-9]{64}$/u.test(source.sha256))).toBe(true);
      expect(Object.isFrozen(entry.bands)).toBe(true);
      expect(Object.isFrozen(entry.bands[0])).toBe(true);
    }
    expect(calculateNationalGrossIrpef127(2025, 4_000_000).ruleRevisionId).toBe("IRPEF-2025-117-v1");
    expect(calculateNationalGrossIrpef127(2026, 4_000_000).ruleRevisionId).toBe("IRPEF-2026-117-v1");
  });

  it("compares Jan 1 rules against an independent bracket oracle and preserves prior years", () => {
    // Oracle: 28,000 × 23% + 12,000 × 35%/33%, using decimal euro arithmetic.
    expect(calculateNationalGrossIrpef127(2025, 4_000_000).grossNationalTaxCents).toBe(1_064_000);
    expect(calculateNationalGrossIrpef127(2026, 4_000_000).grossNationalTaxCents).toBe(1_040_000);
    const change = diffFiscalBands409(original(), getVerifiedNationalIrpef117(2026));
    expect(change.changedBands).toEqual([
      { upToCents: 5_000_000, previousBasisPoints: 3500, nextBasisPoints: 3300 },
    ]);
    expect(change.previousEffectiveFrom).toBe("2025-01-01");
    expect(change.nextEffectiveFrom).toBe("2026-01-01");
    expect(change.addedSourceHashes).toEqual([getVerifiedNationalIrpef117(2026).sources[1]!.sha256]);
    expect(change.removedSourceHashes).toEqual([]);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2027-01-01T00:30:00Z"));
      expect(calculateNationalGrossIrpef127(2025, 4_000_000).grossNationalTaxCents).toBe(1_064_000);
      expect(calculateNationalGrossIrpef127(2026, 4_000_000).grossNationalTaxCents).toBe(1_040_000);
      expect(() => calculateNationalGrossIrpef127(2027, 4_000_000)).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a simulated retroactive amendment forces explicit revision choice and retains historical bytes", () => {
    const v1 = original();
    const serializedBefore = JSON.stringify(v1);
    const rows = [v1, simulatedAmendment()];
    expect(() => selectFiscalRevision409(rows, 2025)).toThrow(/FISCAL409_EXPLICIT_REVISION_REQUIRED/u);
    expect(selectFiscalRevision409(rows, 2025, v1.revisionId)).toBe(v1);
    expect(selectFiscalRevision409(rows, 2025, "TEST-2025-v2").bands[1]?.rateBasisPoints).toBe(3400);
    expect(JSON.stringify(v1)).toBe(serializedBefore);
    expect(diffFiscalBands409(v1, rows[1]!).changedBands).toEqual([
      { upToCents: 5_000_000, previousBasisPoints: 3500, nextBasisPoints: 3400 },
    ]);
  });

  it("fails closed for ambiguous, forged, undated and unpinned retrospective versions", () => {
    const v1 = original();
    const next = simulatedAmendment();
    expect(() => selectFiscalRevision409([v1, next], 2025, "missing")).toThrow(/FISCAL409_UNKNOWN_REVISION/u);
    expect(() => selectFiscalRevision409([v1, { ...next, revisionId: v1.revisionId }], 2025))
      .toThrow(/FISCAL409_DUPLICATE_REVISION/u);
    expect(() => selectFiscalRevision409([v1, { ...next, supersedesRevisionId: "missing" }], 2025, v1.revisionId))
      .toThrow(/FISCAL409_INVALID_AMENDMENT/u);
    expect(() => selectFiscalRevision409([v1, { ...next, checkedAt: "2025-02-30" }], 2025, v1.revisionId))
      .toThrow(/FISCAL409_INVALID_DATE/u);
    expect(() => selectFiscalRevision409([v1, { ...next, sources: [] }], 2025, v1.revisionId))
      .toThrow(/FISCAL409_INVALID_SOURCE/u);
    expect(() => selectFiscalRevision409([v1, { ...next, reviewOwner: null }], 2025, v1.revisionId))
      .toThrow(/FISCAL409_INVALID_AMENDMENT/u);
    expect(() => selectFiscalRevision409([v1, { ...next, sources: v1.sources }], 2025, v1.revisionId))
      .toThrow(/FISCAL409_INVALID_AMENDMENT/u);
    expect(() => selectFiscalRevision409([v1, { ...next, effectiveFrom: "2026-01-01" }], 2025, v1.revisionId))
      .toThrow(/FISCAL409_INVALID_DATE/u);
    expect(() => selectFiscalRevision409(Array.from({ length: 65 }, () => v1), 2025))
      .toThrow(/FISCAL409_REVISION_LIMIT/u);
  });
});
