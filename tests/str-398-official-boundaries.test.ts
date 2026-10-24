import { describe, expect, it } from "vitest";
import { calculateNationalGrossIrpef127 } from "../src/engines/italy/irpef-national-127";
import { calculateIrpefComponents128 } from "../src/engines/italy/irpef-components-128";
import { calculateVerifiedAnnualVatWindow117 } from "../src/reference-data/italy/fiscal-annual-vat-117";

/**
 * STR-398 numerical oracles for the explicit, partial official legal scope.
 * IRPEF: L.207/2024 art.1(2), Normattiva original (2025);
 * L.199/2025 art.1(3), Normattiva consolidated (2026).
 * IVA: MEF/DEF DPR633/1972 art.16 + Table A, exact 13–31/12/2025
 * PDFs SHA-256-pinned by #117. No source is a complete Italian fiscal pack.
 */
describe("STR-398 versioned sourced examples and refusal boundaries", () => {
  it.each([
    [2025, 2_800_000, 644_000],
    [2026, 2_800_000, 644_000],
    [2025, 2_800_100, 644_035],
    [2026, 2_800_100, 644_033],
    [2025, 4_000_000, 1_064_000],
    [2026, 4_000_000, 1_040_000],
    [2025, 5_000_000, 1_414_000],
    [2026, 5_000_000, 1_370_000],
    [2025, 5_000_100, 1_414_043],
    [2026, 5_000_100, 1_370_043],
  ])("uses official %i bands and the marginal tax at cents %i", (taxYear, cents, expected) => {
    const result = calculateNationalGrossIrpef127(taxYear, cents);
    expect(result.grossNationalTaxCents).toBe(expected);
    expect(result.lines.reduce((sum, band) => sum + band.taxCents, 0)).toBe(expected);
    expect(result.taxYear).toBe(taxYear);
    expect(result.ruleRevisionId).toContain("IRPEF-" + taxYear + "-117");
    expect(result.sources.every(({url,sha256}) => url.startsWith("https://www.normattiva.it/") && /^sha256:[a-f0-9]{64}$/u.test(sha256))).toBe(true);
  });

  it("does not substitute 2025 or 2026 for omitted/unsupported tax years", () => {
    for (const year of [undefined, 0, 2024, 2027, Number.NaN]) {
      expect(() => calculateNationalGrossIrpef127(year as number, 4_000_000))
        .toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    }
  });

  it("keeps missing regional/municipal data unknown, never a calculated zero", () => {
    const partial = calculateIrpefComponents128({taxYear: 2025, taxableIncomeCents: 4_000_000,
      region: "unknown", municipality: "unknown", employeeFullYearConfirmed: false});
    expect(partial.national.grossNationalTaxCents).toBe(1_064_000);
    expect(partial.components).toEqual([]);
    expect(partial.finalModeledTaxCents).toBeNull();
    expect(partial.selectedComponentsEstimateCents).toBeNull();
    const sourced = calculateIrpefComponents128({taxYear: 2025, taxableIncomeCents: 4_000_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true});
    expect(sourced.finalModeledTaxCents).toBe(1_067_290);
    expect(sourced.components.map(row => row.cents)).toEqual([86_810, 58_100, 32_000]);
    const nextYear = calculateIrpefComponents128({taxYear: 2026, taxableIncomeCents: 4_000_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true});
    expect(nextYear.national.grossNationalTaxCents).toBe(1_040_000);
    expect(nextYear.finalModeledTaxCents).toBeNull();
    expect(nextYear.components).toEqual([]);
  });

  const milk = {taxYear: 2025, transactionDate: "2025-12-13", categoryId: "tabA-ii-3-fresh-milk",
    confirmsExactLegalCategory: true, confirmsTaxableAndNotExempt: true,
    operation: "add" as const, amountCents: 10_000};
  it("computes only the 2025 verified IVA window, with exact legal category declared", () => {
    for (const day of ["2025-12-13", "2025-12-31"]) {
      const result = calculateVerifiedAnnualVatWindow117({...milk, transactionDate: day});
      expect(result).toMatchObject({taxYear: 2025, vatCents: 400, grossCents: 10_400,
        status: "CONDITIONAL_2025_WINDOW_ESTIMATE", legalReference: "Tabella A parte II n.3"});
      expect(result.sources.length).toBe(2);
      expect(result.sources.every(source => /^sha256:[a-f0-9]{64}$/u.test(source.sha256))).toBe(true);
    }
  });

  it("refuses missing year/date, adjacent tax years and missing legal confirmations", () => {
    for (const input of [
      {...milk, taxYear: undefined as unknown as number},
      {...milk, taxYear: 2026},
      {...milk, transactionDate: ""},
      {...milk, transactionDate: "2025-12-12"},
      {...milk, transactionDate: "2026-01-01"},
      {...milk, confirmsExactLegalCategory: false},
      {...milk, confirmsTaxableAndNotExempt: false},
    ]) {
      expect(() => calculateVerifiedAnnualVatWindow117(input)).toThrow(/VAT117_UNSUPPORTED_YEAR|VAT117_UNSUPPORTED_DATE|VAT117_UNCONFIRMED_SCOPE/u);
    }
  });
});
