import { describe, expect, it } from "vitest";
import { assertItalyCurrentYearClaim158, buildItalyFreshnessReport158 } from "../src/reference-data/italy/freshness-158";

describe("STR-158 Italy source freshness, without promoting old years", () => {
  it("reports current bounded 2026 sources and honestly flags 2025-only excerpts", () => {
    const report = buildItalyFreshnessReport158("2026-10-18");
    expect(report.entries).toHaveLength(12);
    const byId = Object.fromEntries(report.entries.map((entry) => [entry.recordId, entry]));
    expect(byId["annual:national-irpef-gross-subset"]?.status).toBe("CURRENT_BOUNDED");
    expect(byId["annual:inps-contributions-annual"]?.status).toBe("CURRENT_BOUNDED");
    expect(byId["annual:forfettario-ateco2007-coefficients"]?.status).toBe("HISTORICAL_ONLY");
    expect(byId["annual:vat-2025-limited-window"]?.status).toBe("HISTORICAL_ONLY");
    expect(byId["schema:fatturapa-technical-schema"]?.status).toBe("SOURCE_CHANGE_MONITOR");
    expect(byId["decision:STR-117:italy-fiscal-annual"]?.status).toBe("BLOCKED_SOURCE");
    expect(new Set(report.entries.map((entry) => entry.recordId)).size).toBe(report.entries.length);
    expect(report.entries.every((entry) => entry.checkedAt && entry.owner && entry.nextReviewCondition)).toBe(true);
    expect(report.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("annual:forfettario-ateco2007-coefficients: HISTORICAL_ONLY"),
      expect.stringContaining("annual:vat-2025-limited-window: HISTORICAL_ONLY"),
    ]));
  });

  it("simulated 2027 rollover warns on every frozen annual pack without changing historical coverage", () => {
    const report = buildItalyFreshnessReport158("2027-01-01");
    const annualRows = report.entries.filter((entry) => entry.latestSupportedYear !== null);
    expect(annualRows).toHaveLength(5);
    expect(annualRows.every((entry) => entry.status === "HISTORICAL_ONLY")).toBe(true);
    expect(report.entries.find((entry) => entry.datasetId === "fatturapa-technical-schema")?.status).toBe("SOURCE_CHANGE_MONITOR");
  });

  it("a synthetic old as-of never treats future-checked snapshots as contemporaneously verified", () => {
    const old = buildItalyFreshnessReport158("2025-12-31");
    expect(old.entries.find((entry) => entry.recordId === "annual:inps-contributions-annual")?.status).toBe("NOT_YET_CHECKED");
    expect(old.entries.find((entry) => entry.recordId === "annual:forfettario-ateco2007-coefficients")?.status).toBe("NOT_YET_CHECKED");
    expect(old.entries.find((entry) => entry.recordId === "schema:fatturapa-technical-schema")?.status).toBe("NOT_YET_CHECKED");
    expect(() => assertItalyCurrentYearClaim158(old, "forfettario-ateco2007-coefficients", 2025))
      .toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
  });

  it("fails closed on stale current-year claims, unknown packs, and mismatched years", () => {
    const current = buildItalyFreshnessReport158("2026-10-18");
    expect(() => assertItalyCurrentYearClaim158(current, "inps-contributions-annual", 2026)).not.toThrow();
    expect(() => assertItalyCurrentYearClaim158(current, "forfettario-ateco2007-coefficients", 2026)).toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
    expect(() => assertItalyCurrentYearClaim158(current, "vat-2025-limited-window", 2026)).toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
    expect(() => assertItalyCurrentYearClaim158(current, "national-irpef-gross-subset", 2025)).toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
    expect(() => assertItalyCurrentYearClaim158(current, "unknown-dataset", 2026)).toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
    const stale = buildItalyFreshnessReport158("2027-01-01");
    expect(() => assertItalyCurrentYearClaim158(stale, "inps-contributions-annual", 2027)).toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
  });

  it("refuses malformed date inputs rather than silently accepting a new year", () => {
    for (const value of ["2026-02-30", "2026-13-01", "2026", "not-a-date"]) {
      expect(() => buildItalyFreshnessReport158(value)).toThrow("FRESHNESS158_INVALID_DATE");
    }
  });
});
