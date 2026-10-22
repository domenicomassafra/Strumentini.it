import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANNUAL_FISCAL_SOURCE_ROWS_117,
  buildAnnualFiscalSourceReview117,
  getAnnualFiscalSourceRows117,
  isOfficialFiscalSourceUrl117,
  listAnnualFiscalSourceYears117,
} from "../src/reference-data/italy/annual-source-registry-117";
import {
  INVOICE_STAMP_REFERENCE_2024_117,
  VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117,
  VERIFIED_IRPEF_EXCERPTS_117,
} from "../src/reference-data/italy/fiscal-annual-117";
import { ANNUAL_VAT_2025_WINDOW_117 } from "../src/reference-data/italy/fiscal-annual-vat-117";

const pinnedSources = [
  ...VERIFIED_IRPEF_EXCERPTS_117.flatMap((excerpt) => excerpt.sources),
  ...VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117.sources,
  ...ANNUAL_VAT_2025_WINDOW_117.sources,
  INVOICE_STAMP_REFERENCE_2024_117.source,
];

describe("STR-117: Italian fiscal annual official snapshots", () => {
  it("exposes exactly the evidenced years with version, source, dates, validity and SHA-256", () => {
    expect(listAnnualFiscalSourceYears117()).toEqual([2024, 2025, 2026]);
    expect(ANNUAL_FISCAL_SOURCE_ROWS_117).toHaveLength(8);
    for (const row of ANNUAL_FISCAL_SOURCE_ROWS_117) {
      expect(isOfficialFiscalSourceUrl117(row.url)).toBe(true);
      expect(row.authority).not.toBe("");
      expect(row.version).not.toBe("");
      expect(row.checkedAt).toMatch(/^2026-10-\d{2}$/u);
      expect(row.effectiveFrom.slice(0, 4)).toBe(String(row.taxYear));
      expect(row.effectiveTo.slice(0, 4)).toBe(String(row.taxYear));
      expect(row.effectiveFrom <= row.effectiveTo).toBe(true);
      expect(row.sha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(pinnedSources.some((source) => source.url === row.url && source.sha256 === row.sha256)).toBe(true);
    }
    expect(getAnnualFiscalSourceRows117(2024).every((row) => row.coverage === "ARCHIVED_REFERENCE")).toBe(true);
    expect(getAnnualFiscalSourceRows117(2025).some((row) => row.coverage === "VERIFIED_LIMITED_WINDOW")).toBe(true);
    expect(getAnnualFiscalSourceRows117(2026).every((row) => row.coverage === "VERIFIED_IRPEF_SUBSET")).toBe(true);
  });

  it("matches every stored official artifact to its pinned snapshot hash", async () => {
    const unique = new Map(pinnedSources.map((source) => [source.artifactPath, source]));
    for (const source of unique.values()) {
      const bytes = await readFile(resolve(import.meta.dirname, "..", source.artifactPath));
      const actual = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      expect(actual, source.artifactPath).toBe(source.sha256);
    }
  });

  it("leaves unsupported years uncovered, including when the annual check rolls over", () => {
    for (const year of [2023, 2027, 2028]) expect(getAnnualFiscalSourceRows117(year)).toEqual([]);
    expect(buildAnnualFiscalSourceReview117("2026-10-22").currentYearCovered)
      .toEqual(["national-irpef-gross-subset"]);
    const afterRollover = buildAnnualFiscalSourceReview117("2027-01-01");
    expect(afterRollover.ok).toBe(false);
    expect(afterRollover.blockedClaims).toContain("national-irpef-gross-subset:2027");
    expect(afterRollover.rows.every((row) => row.taxYear !== 2027)).toBe(true);
  });
});
