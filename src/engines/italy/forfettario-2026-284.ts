/**
 * #284: EasyPIVA targetNet.ts and planning.ts algorithms, scoped to verified
 * Italian 2026 forfettario data. Pure browser functions: no network or storage.
 * Copyright 2026 Michael Gasperini (TheStreamCode); adapted under MIT.
 * Original c934d2095128355876c7f26a76e492d66a23cec1, v1.1.1.
 * See docs/donor-easypiva-284.md for license, official evidence and rollback.
 */
import { calculateArtigianiCommerciantiContribution, calculateGestioneSeparataContribution } from "./inps-contributions";
import { resolveForfettarioAteco2026_284 } from "./ateco-2026-284";

const CEILING_85K = 8_500_000;
const CEILING_100K = 10_000_000;
const MAX_MONEY_CENTS = 1_000_000_000_000;

export type ForfettarioInpsProfile284 =
  | "professional-no-other-mandatory-pension-coverage"
  | "professional-pensioner-or-other-mandatory-pension-coverage"
  | "artigiano" | "commerciante";

export interface Forfettario2026Input284 {
  readonly taxYear: number;
  readonly atecoVersion: string;
  readonly atecoCode: string;
  readonly priorYearReceiptsCents: number;
  readonly declaresEligible: boolean;
  readonly declaredTaxRate: "standard-15" | "startup-5";
  readonly declaresStartupFivePercentRequirements?: boolean;
  readonly inpsProfile: ForfettarioInpsProfile284 | string;
  readonly declaresOrdinaryProfessional?: boolean;
  readonly contributionSeniority?: "before-1996" | "from-1996" | string;
  readonly contributionRole?: "owner-or-adult-collaborator" | string;
  readonly inpsReduction?: "none" | string;
  readonly paidMandatoryContributionsCents: number;
}

export const FORFETTARIO_2026_SOURCE_284 = Object.freeze({
  taxYear: 2026, effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31",
  annualPriorReceiptsLimitCents: CEILING_85K,
  immediateExitReceiptsCents: CEILING_100K,
  status: "BOUNDED_ESTIMATE_NOT_FISCAL_CERTIFICATION" as const,
  sources: [
    "https://www.normattiva.it/eli/id/2014/12/29/14G00203/CONSOLIDATED/20261019",
    "https://www.normattiva.it/eli/id/2025/06/12/25G00090/CONSOLIDATED/20251231",
    "https://www.gazzettaufficiale.it/eli/gu/2018/12/31/302/so/62/sg/pdf",
    "https://www.istat.it/classificazione/documenti-ateco/",
  ],
});

function checkedCents(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_CENTS) throw new Error(code);
  return value;
}

function percent(cents: number, pct: number): number {
  return Number((BigInt(cents) * BigInt(pct) + 50n) / 100n);
}

function preflight(input: Forfettario2026Input284) {
  if (input.taxYear !== 2026) throw new Error("FORF284_UNSUPPORTED_YEAR");
  const ateco = resolveForfettarioAteco2026_284(input.atecoVersion, input.atecoCode);
  const prior = checkedCents(input.priorYearReceiptsCents, "FORF284_INVALID_PRIOR_RECEIPTS");
  if (prior > CEILING_85K) throw new Error("FORF284_PRIOR_YEAR_OUT_OF_SCOPE");
  if (input.declaresEligible !== true) throw new Error("FORF284_ELIGIBILITY_UNCONFIRMED");
  if (input.declaredTaxRate !== "startup-5" && input.declaredTaxRate !== "standard-15") {
    throw new Error("FORF284_INVALID_TAX_RATE");
  }
  if (input.declaredTaxRate === "startup-5" && input.declaresStartupFivePercentRequirements !== true) {
    throw new Error("FORF284_5_PERCENT_DECLARATION_REQUIRED");
  }
  checkedCents(input.paidMandatoryContributionsCents, "FORF284_INVALID_PAID_CONTRIBUTIONS");
  if (input.inpsProfile === "artigiano" || input.inpsProfile === "commerciante") {
    if (input.contributionSeniority !== "before-1996" && input.contributionSeniority !== "from-1996") {
      throw new Error("FORF284_INPS_SENIORITY_REQUIRED");
    }
    if (input.contributionRole !== "owner-or-adult-collaborator" || input.inpsReduction !== "none") {
      throw new Error("FORF284_INPS_STANDARD_ROLE_REQUIRED");
    }
  } else if (input.inpsProfile === "professional-no-other-mandatory-pension-coverage" ||
    input.inpsProfile === "professional-pensioner-or-other-mandatory-pension-coverage") {
    if (input.declaresOrdinaryProfessional !== true) throw new Error("FORF284_GS_PROFESSIONAL_DECLARATION_REQUIRED");
    if (input.inpsReduction !== undefined || input.contributionRole !== undefined || input.contributionSeniority !== undefined) {
      throw new Error("FORF284_INPS_INCOMPATIBLE_OPTIONS");
    }
  } else throw new Error("FORF284_UNSUPPORTED_INPS_PROFILE");
  return ateco;
}

function forecastInps(input: Forfettario2026Input284, incomeCents: number) {
  const incomeEur = incomeCents / 100;
  if (input.inpsProfile === "artigiano" || input.inpsProfile === "commerciante") {
    const contribution = calculateArtigianiCommerciantiContribution({
      year: 2026, profile: input.inpsProfile, incomeEur,
      contributionSeniority: input.contributionSeniority!,
      role: "owner-or-adult-collaborator", reduction: "none",
    });
    return { profile: contribution.profile, dueCents: Math.round(contribution.totalContributionEur * 100),
      breakdown: contribution.bands, provenance: contribution.provenance };
  }
  const contribution = calculateGestioneSeparataContribution({ year: 2026, profile: input.inpsProfile, incomeEur });
  return { profile: contribution.profile, dueCents: Math.round(contribution.totalContributionEur * 100),
    minimumForFullYearCreditEur: contribution.incomeMinimumForFullYearCreditEur,
    belowFullYearCreditMinimum: contribution.belowFullYearCreditMinimum,
    provenance: contribution.provenance };
}

/** Existing deductions remain paid, never silently replaced by estimated due. */
function estimate(input: Forfettario2026Input284, coefficientPercent: number, receiptsCents: number) {
  const grossIncomeCents = percent(receiptsCents, coefficientPercent);
  const paid = input.paidMandatoryContributionsCents;
  if (paid > grossIncomeCents) throw new Error("FORF284_UNSUPPORTED_EXCESS_PAID_CONTRIBUTIONS");
  const taxableIncomeCents = grossIncomeCents - paid;
  const substituteTaxCents = percent(taxableIncomeCents, input.declaredTaxRate === "startup-5" ? 5 : 15);
  const inps = forecastInps(input, grossIncomeCents);
  return {
    receiptsCents, grossIncomeCents, taxableIncomeCents, substituteTaxCents,
    paidMandatoryContributionsCents: paid, forecastContributionsDueCents: inps.dueCents,
    netAfterPaidAndTaxCents: receiptsCents - paid - substituteTaxCents,
    forecastNetAfterDueAndTaxCents: receiptsCents - inps.dueCents - substituteTaxCents,
    inps,
  };
}

export function calculateForfettario2026_284(input: Forfettario2026Input284 & { readonly yearReceiptsCents: number }) {
  const ateco = preflight(input);
  const receipts = checkedCents(input.yearReceiptsCents, "FORF284_INVALID_RECEIPTS");
  if (receipts > CEILING_100K) throw new Error("FORF284_IMMEDIATE_EXIT_OVER_100K");
  return {
    taxYear: 2026 as const, ateco, declaredTaxRatePercent: input.declaredTaxRate === "startup-5" ? 5 : 15,
    ...estimate(input, ateco.coefficientPercent, receipts),
    warnings: receipts > CEILING_85K ? ["FORF284_OVER_85K_NEXT_YEAR_EXIT"] : [],
    status: "BOUNDED_2026_ESTIMATE" as const,
    limitations: "Only pinned 1:1 ATECO correspondence, user-declared eligibility and standard INPS profiles; 2026 fiscal estimate, not a return. Paid contributions reduce the tax base; due contributions are a separate forecast. No other expenses or advances are estimated.",
    sources: FORFETTARIO_2026_SOURCE_284,
  };
}

/** EasyPIVA's target-net search: prospective net uses INPS due, not already-paid INPS. */
export function calculateTargetNet2026_284(input: Forfettario2026Input284 & { readonly targetAnnualNetCents: number }) {
  const ateco = preflight(input);
  const target = checkedCents(input.targetAnnualNetCents, "FORF284_INVALID_TARGET");
  let low = 0;
  let high = CEILING_100K;
  if (input.paidMandatoryContributionsCents > percent(high, ateco.coefficientPercent) ||
    estimate(input, ateco.coefficientPercent, high).forecastNetAfterDueAndTaxCents < target) {
    throw new Error("FORF284_TARGET_EXCEEDS_VERIFIED_SCOPE");
  }
  // The net can be evaluated only where declared paid contributions do not
  // exceed gross forfettario income. Treat lower points as insufficient.
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (percent(mid, ateco.coefficientPercent) < input.paidMandatoryContributionsCents ||
      estimate(input, ateco.coefficientPercent, mid).forecastNetAfterDueAndTaxCents < target) low = mid + 1;
    else high = mid;
  }
  const detail = calculateForfettario2026_284({ ...input, yearReceiptsCents: high });
  return { targetAnnualNetCents: target, targetBasis: "FORECAST_NET_AFTER_INPS_DUE" as const,
    targetMonthlyNetCents: Math.round(target / 12),
    requiredAnnualReceiptsCents: high, monthlyReceiptsAverageCents: Math.ceil(high / 12),
    ...detail };
}

/** EasyPIVA's cumulative projection; 12 monthly amounts, no implied tax computation. */
export function buildPlanningProjection2026_284(taxYear: number, monthlyReceiptsCents: readonly number[]) {
  if (taxYear !== 2026) throw new Error("FORF284_UNSUPPORTED_YEAR");
  if (monthlyReceiptsCents.length !== 12) throw new Error("FORF284_TWELVE_MONTHS_REQUIRED");
  let total = 0;
  const months = monthlyReceiptsCents.map((raw, index) => {
    const receiptsCents = checkedCents(raw, "FORF284_INVALID_RECEIPTS");
    total += receiptsCents;
    if (!Number.isSafeInteger(total)) throw new Error("FORF284_INVALID_RECEIPTS");
    return { month: index + 1, receiptsCents, cumulativeReceiptsCents: total };
  });
  return { taxYear: 2026 as const, months, totalReceiptsCents: total,
    over85k: total > CEILING_85K, over100k: total > CEILING_100K,
    warnings: total > CEILING_100K ? ["FORF284_IMMEDIATE_EXIT_OVER_100K"]
      : total > CEILING_85K ? ["FORF284_OVER_85K_NEXT_YEAR_EXIT"] : [],
    sources: FORFETTARIO_2026_SOURCE_284,
    limitations: "Revenue projection only. Above €100,000 the forfettario estimate is unavailable; eligibility and midyear VAT effects require separate review.",
  };
}
