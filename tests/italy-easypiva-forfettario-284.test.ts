import { describe, expect, it } from "vitest";
import { resolveForfettarioAteco2026_284, ATECO_2026_284_SOURCE } from "../src/engines/italy/ateco-2026-284";
import {
  buildPlanningProjection2026_284, calculateForfettario2026_284, calculateTargetNet2026_284,
} from "../src/engines/italy/forfettario-2026-284";

const gs = {
  taxYear: 2026, atecoVersion: "ATECO2025", atecoCode: "74.30.00",
  priorYearReceiptsCents: 5_000_000, declaresEligible: true,
  declaredTaxRate: "standard-15", inpsProfile: "professional-no-other-mandatory-pension-coverage",
  declaresOrdinaryProfessional: true, paidMandatoryContributionsCents: 500_000,
} as const;

describe("#284 pinned ISTAT ATECO 2025→2007 correspondence", () => {
  it.each([
    ["01.12.00", "01.12.00", 67], ["10.11.00", "10.11.00", 40],
    ["43.11.00", "43.11.00", 86], ["56.11.11", "56.10.11", 40],
    ["70.20.01", "70.22.01", 78], ["74.30.00", "74.30.00", 78],
    ["96.21.00", "96.02.01", 67],
  ])("matches exact official 2026 correspondence for %s", (ateco, older, coefficient) => {
    expect(resolveForfettarioAteco2026_284("ATECO2025", ateco))
      .toMatchObject({ correspondingAteco2007Code: older, coefficientPercent: coefficient });
  });

  it("refuses ambiguous, missing, undeclared and wrong-version codes; never falls back to 78%", () => {
    for (const code of ["69.10.10", "68.20.01", "47.11.01", "77.77.77", "47.81.09", "46", ""]) {
      expect(() => resolveForfettarioAteco2026_284("ATECO2025", code), code).toThrow(/FORF284_/u);
    }
    expect(() => resolveForfettarioAteco2026_284("ATECO2007", "74.30.00")).toThrow(/EXACT_CODE_REQUIRED/u);
    expect(ATECO_2026_284_SOURCE.correspondenceCount).toBe(10);
    expect(ATECO_2026_284_SOURCE.officialTableSha256).toBe("faf4530a869f1e3d6b68f464520dcddd691f4565d17e92e3988370cf3c808673");
  });
});

describe("#284 2026 fiscal calculations, independent oracle in cents", () => {
  it("calculates exact tax from ALREADY PAID, 15%, GS 26.07%; forecast due stays separate", () => {
    const result = calculateForfettario2026_284({ ...gs, yearReceiptsCents: 4_000_000 });
    // €40,000 × 78% = €31,200; tax (31,200 - 5,000) × 15% = €3,930.
    // INPS GS 2026 circular 8: €31,200 × 26.07% = €8,133.84.
    expect(result).toMatchObject({ grossIncomeCents: 3_120_000, taxableIncomeCents: 2_620_000,
      substituteTaxCents: 393_000, forecastContributionsDueCents: 813_384,
      netAfterPaidAndTaxCents: 3_107_000, forecastNetAfterDueAndTaxCents: 2_793_616,
      status: "BOUNDED_2026_ESTIMATE", warnings: [] });
    expect(result.inps).toMatchObject({ belowFullYearCreditMinimum: false });
    expect(calculateForfettario2026_284({ ...gs, paidMandatoryContributionsCents: 0, yearReceiptsCents: 4_000_000 }))
      .toMatchObject({ taxableIncomeCents: 3_120_000, forecastContributionsDueCents: 813_384,
        substituteTaxCents: 468_000, netAfterPaidAndTaxCents: 3_532_000 });
  });

  it("models 5% only on express declaration, the GS pensioner 24% and full-year credit minimum", () => {
    const input = { ...gs, declaredTaxRate: "startup-5" as const, declaresStartupFivePercentRequirements: true,
      inpsProfile: "professional-pensioner-or-other-mandatory-pension-coverage" as const };
    const result = calculateForfettario2026_284({ ...input, yearReceiptsCents: 2_000_000 });
    expect(result).toMatchObject({ grossIncomeCents: 1_560_000, taxableIncomeCents: 1_060_000,
      substituteTaxCents: 53_000, forecastContributionsDueCents: 374_400,
      netAfterPaidAndTaxCents: 1_447_000 });
    expect(result.inps).toMatchObject({ belowFullYearCreditMinimum: true });
    expect(() => calculateForfettario2026_284({ ...gs, declaredTaxRate: "startup-5", yearReceiptsCents: 4_000_000 }))
      .toThrow(/5_PERCENT_DECLARATION_REQUIRED/u);
  });

  it.each([
    ["artigiano", 452_136, 2400, 2500],
    ["commerciante", 461_164, 2448, 2548],
  ] as const)("uses pinned 2026 INPS %s minimum and both contribution bands", (profile, fixed, firstRate, secondRate) => {
    const { declaresOrdinaryProfessional: _gsOnly, ...autonomousBase } = gs;
    const input = { ...autonomousBase, atecoCode: "43.11.00", inpsProfile: profile,
      contributionSeniority: "from-1996" as const,
      contributionRole: "owner-or-adult-collaborator" as const, inpsReduction: "none" as const };
    const min = calculateForfettario2026_284({ ...input, yearReceiptsCents: 2_000_000 });
    expect(min.grossIncomeCents).toBe(1_720_000);
    expect(min.forecastContributionsDueCents).toBe(fixed);
    const high = calculateForfettario2026_284({ ...input, yearReceiptsCents: 9_000_000 });
    // INPS circular 14/2026: minimum €18,808, first ceiling €56,224,
    // then 1 pp surcharge; here annual income is €77,400.
    const independent = fixed + Math.round((5_622_400 - 1_880_800) * firstRate / 10_000)
      + Math.round((7_740_000 - 5_622_400) * secondRate / 10_000);
    expect(high.forecastContributionsDueCents).toBe(independent);
    expect(high.warnings).toEqual(["FORF284_OVER_85K_NEXT_YEAR_EXIT"]);
  });

  it("fails closed on unverified eligibility, profiles, reductions, amounts, years and 100k immediate exit", () => {
    const estimate = (overrides: Record<string, unknown>) => calculateForfettario2026_284({ ...gs, yearReceiptsCents: 1_000_000, ...overrides });
    for (const [overrides, code] of [
      [{ taxYear: 2025 }, "UNSUPPORTED_YEAR"],
      [{ atecoCode: "68.20.01" }, "UNVERIFIED_ATECO"],
      [{ priorYearReceiptsCents: 8_500_001 }, "PRIOR_YEAR_OUT_OF_SCOPE"],
      [{ declaresEligible: false }, "ELIGIBILITY_UNCONFIRMED"],
      [{ inpsProfile: "unknown" }, "UNSUPPORTED_INPS_PROFILE"],
      [{ declaresOrdinaryProfessional: false }, "GS_PROFESSIONAL_DECLARATION_REQUIRED"],
      [{ paidMandatoryContributionsCents: 1_000_001 }, "UNSUPPORTED_EXCESS_PAID"],
      [{ yearReceiptsCents: 10_000_001 }, "IMMEDIATE_EXIT"],
      [{ yearReceiptsCents: -1 }, "INVALID_RECEIPTS"],
    ] as const) expect(() => estimate(overrides)).toThrow(code);
    expect(() => estimate({ inpsProfile: "artigiano", contributionSeniority: "from-1996",
      contributionRole: "owner-or-adult-collaborator", inpsReduction: "35-percent" })).toThrow(/INPS_STANDARD_ROLE_REQUIRED/u);
  });

  it("distinguishes exactly 85k, 100k, and above 100k for projection and estimate", () => {
    const projection = (total: number) => buildPlanningProjection2026_284(2026, [total, ...Array(11).fill(0)]);
    expect(projection(8_500_000).warnings).toEqual([]);
    expect(projection(8_500_001).warnings).toEqual(["FORF284_OVER_85K_NEXT_YEAR_EXIT"]);
    expect(projection(10_000_000).over100k).toBe(false);
    expect(projection(10_000_001).warnings).toEqual(["FORF284_IMMEDIATE_EXIT_OVER_100K"]);
    expect(calculateForfettario2026_284({ ...gs, yearReceiptsCents: 10_000_000 }).warnings).toHaveLength(1);
    expect(() => projection(-1)).toThrow(/INVALID_RECEIPTS/u);
    expect(() => buildPlanningProjection2026_284(2026, [1, 2])).toThrow(/TWELVE_MONTHS_REQUIRED/u);
    expect(() => buildPlanningProjection2026_284(2027, Array(12).fill(1))).toThrow(/UNSUPPORTED_YEAR/u);
  });

  it("finds the minimal exact cent revenue for target net, including 5% and 15% and near 85k", () => {
    for (const target of [0, 1_000_000, 3_000_000, 6_500_000]) {
      const result = calculateTargetNet2026_284({ ...gs, targetAnnualNetCents: target });
      expect(result.targetBasis).toBe("FORECAST_NET_AFTER_INPS_DUE");
      expect(result.forecastNetAfterDueAndTaxCents).toBeGreaterThanOrEqual(target);
      if (result.requiredAnnualReceiptsCents > 0) {
        const previousGross = Math.floor(((result.requiredAnnualReceiptsCents - 1) * 78 + 50) / 100);
        if (previousGross >= gs.paidMandatoryContributionsCents) {
          const previous = calculateForfettario2026_284({ ...gs, yearReceiptsCents: result.requiredAnnualReceiptsCents - 1 });
          expect(previous.forecastNetAfterDueAndTaxCents).toBeLessThan(target);
        }
      }
    }
    const five = calculateTargetNet2026_284({ ...gs, declaredTaxRate: "startup-5",
      declaresStartupFivePercentRequirements: true, targetAnnualNetCents: 3_000_000 });
    const standard = calculateTargetNet2026_284({ ...gs, targetAnnualNetCents: 3_000_000 });
    expect(five.requiredAnnualReceiptsCents).toBeLessThan(standard.requiredAnnualReceiptsCents);
    // The planning target must not accidentally use the larger "paid-only" net.
    expect(standard.requiredAnnualReceiptsCents).toBeGreaterThan(3_878_822);
    expect(() => calculateTargetNet2026_284({ ...gs, targetAnnualNetCents: 10_000_000 }))
      .toThrow(/TARGET_EXCEEDS_VERIFIED_SCOPE/u);
  });
});
