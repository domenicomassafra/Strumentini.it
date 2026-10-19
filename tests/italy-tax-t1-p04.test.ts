import { describe, expect, it } from "vitest";
import { calculateStipendioNetto130 } from "../src/engines/italy/stipendio-netto-130";
import { calculateForfettarioWithInps133, FORFETTARIO_INPS_2025_SOURCE_133 } from "../src/engines/italy/forfettario-133";
import { calculateTfr134, estimateTfrTax135 } from "../src/engines/italy/tfr-134-135";
import { getInvoiceStampReference152 } from "../src/engines/italy/invoice-stamp-reference-152";

describe("T1-p04 annual fiscal consumer calculations", () => {
  it("reconciles net from worker contribution + gross IRPEF, ignoring installment choice for tax", () => {
    const input = { taxYear: 2026, profile: "agricultural-worker-general", ralCents: 3_000_000,
      declaresFpldBaseEqualsRal: true };
    const p12 = calculateStipendioNetto130({ ...input, payments: 12 });
    for (const payments of [13, 14] as const) {
      const actual = calculateStipendioNetto130({ ...input, payments });
      expect(actual.annualNetCents).toBe(p12.annualNetCents);
      expect(actual.nationalIrpefCents).toBe(p12.nationalIrpefCents);
      expect(actual.installmentsCents.reduce((sum, n) => sum + n, 0)).toBe(actual.annualNetCents);
    }
    expect(p12.workerContributionsCents).toBe(265200);
    expect(p12.employerContributionsCents).toBe(649800);
    expect(p12.taxableCents).toBe(2734800);
    expect(p12.nationalIrpefCents).toBe(629004);
    expect(p12.ralCents - p12.workerContributionsCents - p12.nationalIrpefCents).toBe(p12.annualNetCents);
    expect(() => calculateStipendioNetto130({ ...input, ralCents: 5_622_401, payments: 12 })).toThrow();
    expect(() => calculateStipendioNetto130({ ...input, declaresFpldBaseEqualsRal: false, payments: 12 })).toThrow();
  });

  it("separates forecast INPS from actually paid deduction in forfettario 2025", () => {
    const input = { taxYear: 2025, atecoVersion: "ATECO2007", atecoCode: "62.01.00",
      priorYearReceiptsCents: 2_000_000, yearReceiptsCents: 3_000_000, paidMandatoryContributionsCents: 100_000,
      declaredRate: "standard-15" as const, declaresEligible: true,
      inpsProfile: "gs-2025-exclusive" as const, declaresOrdinaryGsProfessional: true };
    const a = calculateForfettarioWithInps133(input);
    expect(a.coefficientPercent).toBe(67);
    expect(a.grossForfettarioIncomeCents).toBe(2_010_000);
    expect(a.forecastContributionsCents).toBe(524_007);
    expect(a.taxableIncomeCents).toBe(1_910_000);
    expect(a.substituteTaxCents).toBe(286_500);
    expect(a.estimatedNetAfterTaxAndContributionsCents).toBe(2_613_500);
    expect(a.forecastNetAfterTaxAndInpsCents).toBe(2_189_493);
    // Primary rule: INPS circular 27/2025, sections 2 and 6 (professionals 26.07%/24%, ceiling €120607).
    // https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2025/01/Circolare_14807/Allegati/15871_Circolare-numero-27-del-30-01-2025.pdf
    expect(FORFETTARIO_INPS_2025_SOURCE_133).toMatchObject({ year: 2025, publishedAt: "2025-01-30",
      incomeMaximumCents: 12_060_700, rateBasisPoints: { "gs-2025-exclusive": 2607, "gs-2025-other-coverage": 2400 } });
    expect(a.inpsSource.url).toContain("inps.it/");
    const b = calculateForfettarioWithInps133({ ...input, inpsProfile: "gs-2025-other-coverage" });
    expect(b.forecastContributionsCents).toBe(482_400);
    expect(() => calculateForfettarioWithInps133({ ...input, declaresOrdinaryGsProfessional: false }))
      .toThrow(/GS_PROFESSIONAL_DECLARATION_REQUIRED/u);
    expect(() => calculateForfettarioWithInps133({ ...input, inpsProfile: "gs-unknown" as typeof input.inpsProfile }))
      .toThrow(/UNSUPPORTED_INPS_PROFILE/u);
    expect(() => calculateForfettarioWithInps133({ ...input, declaredRate: "startup-5" })).toThrow(/5_PERCENT/u);
    expect(() => calculateForfettarioWithInps133({ ...input, taxYear: 2026 })).toThrow(/UNSUPPORTED_YEAR/u);
  });

  it("shows accrued TFR and sourced 2025 revaluation separately, returns partial for missing monthly index", () => {
    const input = { referenceYear: 2025, priorTfrCents: 1_000_000, eligibleAnnualSalaryCents: 2_700_000,
      serviceMonthsThisYear: 12, officialDecemberIndexAvailable: true };
    const a = calculateTfr134(input);
    expect(a).toMatchObject({ state: "DECEMBER_2025_REFERENCE", annualAccrualCents: 200_000,
      revaluationCents: 23_111, grossTfrCents: 1_223_111 });
    expect(calculateTfr134({ ...input, serviceMonthsThisYear: 7 }).state).toBe("PARTIAL_MISSING_MONTHLY_INDEX");
    expect(calculateTfr134({ ...input, officialDecemberIndexAvailable: false }).revaluationCents).toBeNull();
    expect(() => calculateTfr134({ ...input, referenceYear: 2026 })).toThrow();
  });

  it("keeps indicative tax separate and never fabricates a rate with missing history", () => {
    expect(estimateTfrTax135({ taxYear: 2025, eligibleTfrBaseCents: 1_200_000,
      historicalAnnualReferenceIncomeCents: null, verifiedYearsOfHistory: 0 })).toMatchObject({
      state: "PARTIAL_HISTORY_MISSING", taxCents: null,
    });
    const result = estimateTfrTax135({ taxYear: 2025, eligibleTfrBaseCents: 1_200_000,
      historicalAnnualReferenceIncomeCents: 3_000_000, verifiedYearsOfHistory: 5 });
    expect(result).toMatchObject({ state: "ILLUSTRATIVE_TAX_ONLY", taxCents: 285_600 });
  });

  it("checks 2024 Agenzia stamp duty exact threshold and refuses other scopes", () => {
    const input = { sourceYear: 2024, ordinarySingleLine: true, amountCents: 7747,
      nature: "N2.2", declaresNoSpecialExemptions: true };
    expect(getInvoiceStampReference152(input)).toMatchObject({ state: "REFERENCE", referenceStampCents: 0 });
    expect(getInvoiceStampReference152({ ...input, amountCents: 7748 })).toMatchObject({ state: "REFERENCE", referenceStampCents: 200 });
    expect(getInvoiceStampReference152({ ...input, sourceYear: 2026 })).toMatchObject({ state: "OUT_OF_SCOPE", referenceStampCents: null });
    expect(getInvoiceStampReference152({ ...input, ordinarySingleLine: false })).toMatchObject({ state: "OUT_OF_SCOPE", referenceStampCents: null });
  });
});
