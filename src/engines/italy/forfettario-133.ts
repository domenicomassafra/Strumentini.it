/**
 * #133 narrow 2025 source-backed ATECO2007 69/70 forfettario projection.
 * Other coefficients still fail closed. Paid INPS is a user-verified amount,
 * not an invented 2025 INPS contribution-rate or eligibility calculation.
 */
export interface ForfettarioPreflight133 {
  readonly taxYear: number;
  readonly priorYearReceiptsCents: number;
  readonly atecoVersion: string;
  readonly atecoCode: string;
  readonly declaredRate: "standard-15" | "startup-5";
  readonly declaresEligible: boolean;
  readonly declaresStartupFivePercentRequirements?: boolean;
}

export const FORFETTARIO_2025_SOURCE_133 = Object.freeze({
  taxYear: 2025,
  effectiveFrom: "2025-01-01",
  effectiveTo: "2025-12-31",
  annualPriorReceiptsLimitCents: 8_500_000,
  atecoCoefficientVersion: "ATECO2007",
  status: "NARROW_ATECO2007_69_70_COEFFICIENT_78_ONLY" as const,
  sources: [
    {
      authority: "Normattiva",
      path: "quality/reference-data/italy/artifacts/117-fiscal-annual/normattiva-law190-forfettario-2025.html",
      url: "https://www.normattiva.it/eli/id/2014/12/29/14G00203/CONSOLIDATED/20251231",
      sha256: "sha256:b84353f1f5ab45376c8101ca0fc1ce8c0558ec3a7bd68e11ec2cab8973fffbfb",
    },
    {
      authority: "Normattiva",
      path: "quality/reference-data/italy/artifacts/117-fiscal-annual/normattiva-dlgs81-ateco-2025.html",
      url: "https://www.normattiva.it/eli/id/2025/06/12/25G00090/CONSOLIDATED/20251231",
      sha256: "sha256:0ea7d51d7ee21c85445ae7be493eb2225ee38bd7b5c5d7e3fd0b2eec149c5669",
    },
    {
      authority: "Gazzetta Ufficiale",
      path: "quality/reference-data/italy/artifacts/117-fiscal-annual/gu-law145-2018-supplement-annex2.pdf",
      url: "https://www.gazzettaufficiale.it/eli/gu/2018/12/31/302/so/62/sg/pdf",
      sha256: "sha256:19e507421ba6fb7f856d5c3bee3dcbf53bf3efc9a22114562951d11932bbd142",
      pageNumber: 218,
    },
  ] as const,
});

const verifiedCoefficient133 = (atecoCode: string): 78 | null =>
  /^(?:69|70)(?:\.|$)/u.test(atecoCode) ? 78 : null;

const roundPercent133 = (cents: number, percent: number): number =>
  Number((BigInt(cents) * BigInt(percent) + 50n) / 100n);

const supportedMoney133 = (cents: number, code: string) => {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 1_000_000_000_000) throw new Error(code);
  return cents;
};

/** Reports only verified law scope, never infers regime eligibility from amount alone. */
export function inspectForfettario133(input: ForfettarioPreflight133) {
  if (input.taxYear !== FORFETTARIO_2025_SOURCE_133.taxYear) throw new Error("FORF133_UNSUPPORTED_YEAR");
  if (input.atecoVersion !== "ATECO2007" || !/^\d{2}(?:\.\d{1,2}){0,2}$/u.test(input.atecoCode)) {
    throw new Error("FORF133_UNSUPPORTED_ATECO: 2025 law uses ATECO2007; conversion from 2025 codes is not presumed");
  }
  if (!Number.isSafeInteger(input.priorYearReceiptsCents) || input.priorYearReceiptsCents < 0) {
    throw new Error("FORF133_INVALID_REVENUE: integer cents required");
  }
  if (input.declaresEligible !== true) throw new Error("FORF133_ELIGIBILITY_UNCONFIRMED");
  if (input.declaredRate === "startup-5" && input.declaresStartupFivePercentRequirements !== true) {
    throw new Error("FORF133_5_PERCENT_DECLARATION_REQUIRED: 5% startup eligibility must be declared expressly");
  }
  if (input.declaredRate !== "standard-15" && input.declaredRate !== "startup-5") {
    throw new Error("FORF133_INVALID_TAX_RATE");
  }
  return {
    taxYear: FORFETTARIO_2025_SOURCE_133.taxYear,
    annualPriorReceiptsLimitCents: FORFETTARIO_2025_SOURCE_133.annualPriorReceiptsLimitCents,
    revenueThresholdSatisfied: input.priorYearReceiptsCents <= FORFETTARIO_2025_SOURCE_133.annualPriorReceiptsLimitCents,
    declaredRatePercent: input.declaredRate === "standard-15" ? 15 : 5,
    atecoCode: input.atecoCode,
    atecoVersion: "ATECO2007" as const,
    coefficientPercent: verifiedCoefficient133(input.atecoCode),
    status: input.priorYearReceiptsCents > FORFETTARIO_2025_SOURCE_133.annualPriorReceiptsLimitCents
      ? "OUT_OF_SCOPE_LIMIT" as const : verifiedCoefficient133(input.atecoCode) === null
        ? "BLOCKED_OFFICIAL_COEFFICIENT" as const : "SOURCE_BACKED_COEFFICIENT_READY" as const,
    sources: FORFETTARIO_2025_SOURCE_133.sources,
    limitation: "Only 2025 ATECO2007 69/70 coefficient (78%) is pinned to Gazzetta Ufficiale Law145/2018 Annex2. Other exclusions remain user-declared; INPS contribution computations from other years must not be reused.",
  };
}

export function calculateForfettario133(input: ForfettarioPreflight133 & {
  readonly yearReceiptsCents: number;
  readonly paidMandatoryContributionsCents: number;
  readonly userProvidedCoefficientPercent?: number;
}) {
  const preflight = inspectForfettario133(input);
  if (input.userProvidedCoefficientPercent !== undefined) {
    throw new Error("FORF133_USER_COEFFICIENT_REFUSED: only exact pinned ATECO 2007 mapping is accepted");
  }
  if (preflight.status === "OUT_OF_SCOPE_LIMIT") throw new Error("FORF133_OUT_OF_SCOPE_LIMIT");
  if (preflight.coefficientPercent === null) throw new Error("FORF133_OFFICIAL_COEFFICIENT_MISSING");
  const revenue = supportedMoney133(input.yearReceiptsCents, "FORF133_INVALID_REVENUE");
  const contributions = supportedMoney133(input.paidMandatoryContributionsCents, "FORF133_INVALID_CONTRIBUTIONS");
  // Conservative supported range: never extrapolate rules for receipts >85k
  // or claim eligibility above the year's declared original ceiling.
  if (revenue > FORFETTARIO_2025_SOURCE_133.annualPriorReceiptsLimitCents) throw new Error("FORF133_OUT_OF_SCOPE_RECEIPTS");
  const income = roundPercent133(revenue, preflight.coefficientPercent);
  if (contributions > income) throw new Error("FORF133_OUT_OF_SCOPE_CONTRIBUTIONS: excess deduction is not modeled");
  const taxable = income - contributions;
  const tax = roundPercent133(taxable, preflight.declaredRatePercent);
  return {
    taxYear: 2025 as const, atecoVersion: "ATECO2007" as const, atecoCode: preflight.atecoCode,
    yearReceiptsCents: revenue, coefficientPercent: preflight.coefficientPercent,
    grossForfettarioIncomeCents: income, paidMandatoryContributionsCents: contributions,
    contributionOrigin: "USER_DECLARED_ALREADY_PAID" as const,
    taxableIncomeCents: taxable, declaredTaxRatePercent: preflight.declaredRatePercent,
    substituteTaxCents: tax, estimatedNetAfterTaxAndContributionsCents: revenue - contributions - tax,
    status: "SOURCE_BACKED_2025_SUBSET_ESTIMATE" as const,
    rounding: "HALF_UP_AT_EACH_LEGAL_CENT_STAGE" as const,
    sources: preflight.sources,
    limitations: "Source-bound 2025 income approximation, not eligibility certification or a tax return. No 2025 INPS rate or benefit calculation: only user-verified mandatory contributions already paid. Expenses, other regimes, special exclusions and credits are not modeled.",
  };
}
