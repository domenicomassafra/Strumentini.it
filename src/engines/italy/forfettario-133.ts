/**
 * #133 2025 source-backed ATECO2007 official nine-row coefficient projection.
 * Code groups NOT named by the printed table still fail closed. Paid INPS is a user-verified amount,
 * not an invented 2025 INPS contribution-rate or eligibility calculation.
 */
import { getVerifiedForfettarioCoefficients117 } from "../../reference-data/italy/fiscal-annual-117";
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
  status: "OFFICIAL_2025_ATECO2007_NINE_ROW_COEFFICIENT_TABLE_ONLY" as const,
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

/** ATECO2007 group matches use exact dot-delimited boundaries. An unlisted
 * branch cannot inherit a sector coefficient: 46 and 47 alone are ambiguous.
 * The 9 rows are sourced independently from #117's pinned official Annex2.
 */
export function getForfettarioAteco2007Coefficient133(atecoCode: string) {
  if (typeof atecoCode !== "string" || !/^\d{2}(?:\.\d{1,2}){0,2}$/u.test(atecoCode)) return null;
  const rows = getVerifiedForfettarioCoefficients117(2025).rows.filter((row) => row.prefixes.some((prefix) =>
    atecoCode === prefix || atecoCode.startsWith(`${prefix}.`)
    // Partial 46.x/47.x branches are ATECO2007 section prefixes, so 46.19
    // belongs to 46.1, but 46.10 does not belong to 46.2 (no overmatching).
    || (prefix.length === 4 && atecoCode.length > 4 && atecoCode.startsWith(prefix) && /^[0-9.]$/u.test(atecoCode[4]!))));
  if (rows.length > 1) throw new Error("FORF133_AMBIGUOUS_SOURCE_TABLE: overlapping official Annex2 rows");
  if (rows.length !== 1) return null;
  const row = rows[0]!;
  return { atecoVersion: "ATECO2007" as const, sourceTableRow: row.sourceTableRow,
    sectorLabel: row.sectorLabel, coefficientPercent: row.coefficientPercent };
}

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
  const coefficient = getForfettarioAteco2007Coefficient133(input.atecoCode);
  return {
    taxYear: FORFETTARIO_2025_SOURCE_133.taxYear,
    annualPriorReceiptsLimitCents: FORFETTARIO_2025_SOURCE_133.annualPriorReceiptsLimitCents,
    revenueThresholdSatisfied: input.priorYearReceiptsCents <= FORFETTARIO_2025_SOURCE_133.annualPriorReceiptsLimitCents,
    declaredRatePercent: input.declaredRate === "standard-15" ? 15 : 5,
    atecoCode: input.atecoCode,
    atecoVersion: "ATECO2007" as const,
    coefficientPercent: coefficient?.coefficientPercent ?? null,
    coefficientTableRow: coefficient?.sourceTableRow ?? null,
    coefficientSector: coefficient?.sectorLabel ?? null,
    status: input.priorYearReceiptsCents > FORFETTARIO_2025_SOURCE_133.annualPriorReceiptsLimitCents
      ? "OUT_OF_SCOPE_LIMIT" as const : coefficient === null
        ? "BLOCKED_OFFICIAL_COEFFICIENT" as const : "SOURCE_BACKED_COEFFICIENT_READY" as const,
    sources: FORFETTARIO_2025_SOURCE_133.sources,
    limitation: "Nine ATECO2007 coefficient rows pinned to Gazzetta Ufficiale Law145/2018 Annex2; rows not listed are rejected. Applicable regime/legal exclusions remain user-declared; 2025 INPS contribution computations are not verified and cannot be inferred from other years.",
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
    coefficientTableRow: preflight.coefficientTableRow, coefficientSector: preflight.coefficientSector,
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

/** Limited 2025 INPS Gestione Separata professional path from INPS circular 27/2025.
 * Contributions due are a forecast; only contributions the user actually paid
 * in 2025 may be deducted from the substitute-tax base above.
 * https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2025/01/Circolare_14807/Allegati/15871_Circolare-numero-27-del-30-01-2025.pdf
 */
export function calculateForfettarioWithInps133(input: Parameters<typeof calculateForfettario133>[0] & {
  readonly inpsProfile: "gs-2025-exclusive" | "gs-2025-other-coverage";
}) {
  const result = calculateForfettario133(input);
  if (input.inpsProfile !== "gs-2025-exclusive" && input.inpsProfile !== "gs-2025-other-coverage") {
    throw new Error("FORF133_UNSUPPORTED_INPS_PROFILE");
  }
  const rateBasisPoints = input.inpsProfile === "gs-2025-exclusive" ? 2607 : 2400;
  // 2025 INPS maximum base €120607; supported ATECO income is below that ceiling.
  const forecastContributionsCents = Number(
    (BigInt(result.grossForfettarioIncomeCents) * BigInt(rateBasisPoints) + 5000n) / 10000n);
  return {
    ...result,
    inpsProfile: input.inpsProfile,
    forecastContributionRatePercent: rateBasisPoints / 100,
    forecastContributionsCents,
    forecastNetAfterTaxAndInpsCents: result.yearReceiptsCents - forecastContributionsCents - result.substituteTaxCents,
    inpsSource: "https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2025/01/Circolare_14807/Allegati/15871_Circolare-numero-27-del-30-01-2025.pdf",
    inpsLimitations: "Solo professionisti ordinari Gestione Separata 2025 (26,07% esclusiva; 24% pensionato/altra copertura). La quota INPS è una previsione su reddito forfettario, non prova di avvenuto versamento o saldo/acconto; 2025 niente casistiche speciali o altre casse. Ai fini dell'imposta si sottraggono SOLO i contributi già pagati dichiarati dall'utente.",
  };
}
