import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  ANNUAL_FISCAL_SOURCE_ROWS_117,
  assertAnnualFiscalSourceReview117,
  assertOfficialFiscalSource117,
  buildAnnualFiscalSourceReview117,
  getAnnualFiscalSourceRows117,
  isOfficialFiscalSourceUrl117,
  listAnnualFiscalSourceYears117,
} from "../src/reference-data/italy/annual-source-registry-117";
import { getVerifiedNationalIrpef117 } from "../src/reference-data/italy/fiscal-annual-117";

const execFileAsync = promisify(execFile);

describe("STR-117 annual official fiscal source registry", () => {
  it("publishes one dated, versioned row per year and official source only", () => {
    expect(listAnnualFiscalSourceYears117()).toEqual([2024, 2025, 2026]);
    for (const entry of ANNUAL_FISCAL_SOURCE_ROWS_117) {
      expect(isOfficialFiscalSourceUrl117(entry.url)).toBe(true);
      expect(entry.url.startsWith("https://")).toBe(true);
      expect(entry.version.length).toBeGreaterThan(3);
      expect(entry.authority.length).toBeGreaterThan(3);
      expect(entry.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(entry.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(entry.effectiveTo).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(entry.effectiveFrom < entry.effectiveTo).toBe(true);
      expect(entry.sha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  it("refuses non-official, look-alike and plain-http sources", () => {
    expect(() => assertOfficialFiscalSource117("http://www.normattiva.it/x")).toThrow(/NOT_OFFICIAL/u);
    expect(() => assertOfficialFiscalSource117("https://evil-normattiva.it/x")).toThrow(/NOT_OFFICIAL/u);
    expect(() => assertOfficialFiscalSource117("https://normattiva.it.example.com/x")).toThrow(/NOT_OFFICIAL/u);
    expect(() => assertOfficialFiscalSource117("https://blog.example/x")).toThrow(/NOT_OFFICIAL/u);
    expect(isOfficialFiscalSourceUrl117("https://www.gazzettaufficiale.it/eli/gu/2018/12/31/302/so/62/sg/pdf")).toBe(true);
    expect(isOfficialFiscalSourceUrl117("https://def.giustiziatributaria.gov.it/x")).toBe(true);
    expect(isOfficialFiscalSourceUrl117("https://www1.agenziaentrate.gov.it/x")).toBe(true);
  });

  it("keeps each year separate: an unsupported year never inherits another year", () => {
    expect(getAnnualFiscalSourceRows117(2027)).toEqual([]);
    expect(getAnnualFiscalSourceRows117(2025).every((entry) => entry.taxYear === 2025)).toBe(true);
    expect(() => getVerifiedNationalIrpef117(2027)).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    expect(buildAnnualFiscalSourceReview117("2026-10-21").rows).toEqual(ANNUAL_FISCAL_SOURCE_ROWS_117);
  });

  it("passes today and fails closed on the January 1 rollover", () => {
    const today = buildAnnualFiscalSourceReview117("2026-10-21");
    expect(today.currentYear).toBe(2026);
    expect(today.nextAnnualReviewAt).toBe("2027-01-01");
    expect(today.currentYearCovered).toContain("national-irpef-gross-subset");
    expect(today.blockedClaims).toEqual([]);
    expect(today.ok).toBe(true);
    expect(today.warnings.length).toBeGreaterThan(0);

    const rollover = buildAnnualFiscalSourceReview117("2027-01-01");
    expect(rollover.currentYear).toBe(2027);
    expect(rollover.ok).toBe(false);
    expect(rollover.blockedClaims).toEqual(["national-irpef-gross-subset:2027"]);
    expect(() => assertAnnualFiscalSourceReview117("2027-01-01")).toThrow(/ANNUAL_FISCAL_SOURCE_STALE_117/u);
    expect(() => assertAnnualFiscalSourceReview117("2026-10-21")).not.toThrow();
    expect(() => buildAnnualFiscalSourceReview117("2027-02-30")).toThrow(/INVALID_DATE/u);
  });

  it("does not adopt a source checked after the reference date", () => {
    const beforeCheck = buildAnnualFiscalSourceReview117("2026-10-05");
    expect(beforeCheck.currentYearCovered).toEqual([]);
    expect(beforeCheck.blockedClaims).toEqual(["national-irpef-gross-subset:2026"]);
  });

  it("automates the annual review and reports it on the public page", async () => {
    const workflow = await readFile(resolve(import.meta.dirname, "../.github/workflows/annual-fiscal-review.yml"), "utf8");
    expect(workflow).toMatch(/cron: '0 6 1 \* \*'/u);
    expect(workflow).toContain("scripts/italy-annual-source-review-117.ts --check");
    expect(workflow).toMatch(/gh issue create/u);
    expect(workflow).toMatch(/issues: write/u);

    const page = await readFile(resolve(import.meta.dirname, "../src/pages/fonti-fiscali-italia.astro"), "utf8");
    expect(page).toContain("data-annual-sources117");
    expect(page).toContain("data-annual-review117");
    expect(page).toContain("Agenzia delle Entrate");
    expect(page).toContain("SHA-256");
  });

  it("exits 0 today and 1 on the first day of an uncovered year", async () => {
    const script = resolve(import.meta.dirname, "../scripts/italy-annual-source-review-117.ts");
    const run = (asOf: string) => execFileAsync(process.execPath, ["--import", "tsx", script, "--as-of", asOf, "--check"], {
      cwd: resolve(import.meta.dirname, ".."), timeout: 120_000,
    }).then((result) => ({ code: 0, stdout: result.stdout }), (error: { code?: number; stdout?: string; stderr?: string }) => ({
      code: error.code ?? 1, stdout: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    }));
    const current = await run("2026-10-21");
    expect(current.code).toBe(0);
    expect(current.stdout).toContain("OK: national-irpef-gross-subset 2026");
    const rollover = await run("2027-01-01");
    expect(rollover.code).toBe(1);
    expect(rollover.stdout).toContain("STALE: national-irpef-gross-subset:2027");
  });
});
