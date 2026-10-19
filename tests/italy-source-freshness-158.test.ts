import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { assertItalyCurrentYearClaim158, assertItalyPinnedAnnualUse158, buildItalyFreshnessReport158, todayItaly158 } from "../src/reference-data/italy/freshness-158";
import { calculateNationalGrossIrpef127 } from "../src/engines/italy/irpef-national-127";
import { calculateEmployeeAgriculturalContribution } from "../src/engines/italy/inps-contributions";
import { optimizeItalianBridges } from "../src/engines/italy/bridge-leave-optimizer";

describe("STR-158 Italy source freshness, without promoting old years", () => {
  it("reports current bounded 2026 sources and honestly flags 2025-only excerpts", () => {
    const report = buildItalyFreshnessReport158("2026-10-18");
    expect(report.entries).toHaveLength(17);
    const byId = Object.fromEntries(report.entries.map((entry) => [entry.recordId, entry]));
    expect(byId["annual:national-irpef-gross-subset"]?.status).toBe("CURRENT_BOUNDED");
    expect(byId["annual:inps-contributions-annual"]?.status).toBe("CURRENT_BOUNDED");
    expect(byId["annual:forfettario-ateco2007-coefficients"]?.status).toBe("HISTORICAL_ONLY");
    expect(byId["annual:vat-2025-limited-window"]?.status).toBe("HISTORICAL_ONLY");
    expect(byId["annual:inps-agricultural-fpld-2025"]?.status).toBe("HISTORICAL_ONLY");
    expect(byId["annual:irpef-components-bari-puglia-2025"]?.status).toBe("HISTORICAL_ONLY");
    expect(byId["annual:forfettario-inps-gs-2025"]?.status).toBe("HISTORICAL_ONLY");
    expect(byId["annual:tfr-foi-december-2025"]?.status).toBe("HISTORICAL_ONLY");
    expect(byId["annual:invoice-stamp-reference-2024"]?.status).toBe("HISTORICAL_ONLY");
    expect(byId["schema:fatturapa-technical-schema"]?.status).toBe("SOURCE_CHANGE_MONITOR");
    expect(byId["decision:STR-117:italy-fiscal-annual"]?.status).toBe("BLOCKED_SOURCE");
    expect(new Set(report.entries.map((entry) => entry.recordId)).size).toBe(report.entries.length);
    expect(report.entries.every((entry) => entry.checkedAt && entry.owner && entry.nextReviewCondition)).toBe(true);
    expect(report.consumers.every((consumer) => consumer.source?.sourceUrl && consumer.source?.checkedAt)).toBe(true);
    expect(report.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("annual:forfettario-ateco2007-coefficients: HISTORICAL_ONLY"),
      expect.stringContaining("annual:vat-2025-limited-window: HISTORICAL_ONLY"),
    ]));
  });

  it("simulated 2027 rollover warns on every frozen annual pack without changing historical coverage", () => {
    const report = buildItalyFreshnessReport158("2027-01-01");
    const annualRows = report.entries.filter((entry) => entry.latestSupportedYear !== null);
    expect(annualRows).toHaveLength(10);
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

  it("registers all annual and schema consumers with source URLs and local entry points", () => {
    const report = buildItalyFreshnessReport158("2026-10-19");
    expect(report.consumers.length).toBeGreaterThanOrEqual(27);
    expect(new Set(report.consumers.map((entry) => entry.consumerId)).size).toBe(report.consumers.length);
    for (const consumer of report.consumers) {
      expect(consumer.source?.sourceUrl).toMatch(/^https:\/\//u);
      expect(consumer.source?.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(consumer.source?.owner).toBeTruthy();
      expect(consumer.source?.nextReviewCondition).toBeTruthy();
      expect(() => readFileSync(consumer.path, "utf8")).not.toThrow();
    }
  });

  it("refuses an expired review while the supported year is still 2026", () => {
    const report = buildItalyFreshnessReport158("2026-12-31");
    for (const datasetId of ["national-irpef-gross-subset", "inps-contributions-annual", "italy-national-holidays"]) {
      expect(report.entries.find((entry) => entry.datasetId === datasetId)?.status).toBe("REVIEW_EXPIRED");
      expect(() => assertItalyCurrentYearClaim158(report, datasetId, 2026))
        .toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
      expect(() => assertItalyPinnedAnnualUse158(datasetId, 2026, "2026-12-31"))
        .toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
    }
    expect(() => assertItalyPinnedAnnualUse158("national-irpef-gross-subset", 2025, "2027-01-01")).not.toThrow();
  });

  it("uses Italian civil time for the year and review boundary, even when the host is UTC", () => {
    expect(todayItaly158(new Date("2026-12-30T23:30:00Z"))).toBe("2026-12-31");
    expect(todayItaly158(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-12-30T23:30:00Z"));
      expect(() => calculateNationalGrossIrpef127(2026, 3_000_000))
        .toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks real public calculation engine entry points at rollover without fetching any network", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-12-31T12:00:00Z"));
      expect(() => calculateNationalGrossIrpef127(2026, 3_000_000))
        .toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
      expect(() => calculateEmployeeAgriculturalContribution({
        year: 2026, profile: "agricultural-worker-general", contributionBaseEur: 30000,
      })).toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
      expect(() => optimizeItalianBridges({ year: 2026, leaveDayBudget: 1, workweek: ["MON"] }))
        .toThrow(/FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM/u);
      vi.setSystemTime(new Date("2027-01-02T12:00:00Z"));
      expect(calculateNationalGrossIrpef127(2025, 3_000_000).taxYear).toBe(2025);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses malformed date inputs rather than silently accepting a new year", () => {
    for (const value of ["2026-02-30", "2026-13-01", "2026", "not-a-date"]) {
      expect(() => buildItalyFreshnessReport158(value)).toThrow("FRESHNESS158_INVALID_DATE");
    }
  });
});
