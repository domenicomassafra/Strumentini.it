import {
  getItalyReferenceProvenance,
  INPS_CONTRIBUTIONS_2026,
  type GestioneSeparataProfessionalProfile,
  type InpsAutonomousProfile,
  type InpsContributionSeniority,
  type InpsEmployeeProfile,
} from "../../reference-data/italy";

export const INPS_CONTRIBUTION_ENGINE_VERSION = "2026.2";

export type InpsContributionErrorCode =
  | "INCOME_INVALID"
  | "INCOME_PRECISION_UNSUPPORTED"
  | "UNSUPPORTED_INPS_YEAR"
  | "UNSUPPORTED_EMPLOYEE_PROFILE"
  | "EMPLOYEE_BASE_ABOVE_BOUNDED_V1"
  | "EMPLOYEE_PART_TIME_HOURLY_MINIMUM_NOT_MET"
  | "UNSUPPORTED_ARTIGIANI_COMMERCIANTI_PROFILE"
  | "UNSUPPORTED_ARTIGIANI_COMMERCIANTI_REDUCTION"
  | "UNSUPPORTED_ARTIGIANI_COMMERCIANTI_ROLE"
  | "UNSUPPORTED_CONTRIBUTION_SENIORITY"
  | "UNSUPPORTED_GESTIONE_SEPARATA_PROFILE";

export class InpsContributionError extends Error {
  readonly code: InpsContributionErrorCode;

  constructor(code: InpsContributionErrorCode, message: string) {
    super(message);
    this.name = "InpsContributionError";
    this.code = code;
  }
}

function moneyToCents(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new InpsContributionError("INCOME_INVALID", "Income must be a finite non-negative euro amount.");
  }
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 1e-7) {
    throw new InpsContributionError("INCOME_PRECISION_UNSUPPORTED", "Income supports at most two decimal places.");
  }
  if (!Number.isSafeInteger(cents)) {
    throw new InpsContributionError("INCOME_INVALID", "Income is outside the supported exact-cent range.");
  }
  return cents;
}

function centsToMoney(cents: number): number {
  return cents / 100;
}

function percentToBasisPoints(ratePercent: number): number {
  const basisPoints = Math.round(ratePercent * 100);
  if (!Number.isInteger(basisPoints)) throw new Error("INTERNAL_UNSUPPORTED_RATE_PRECISION");
  return basisPoints;
}

function applyRate(cents: number, ratePercent: number): number {
  return Math.round((cents * percentToBasisPoints(ratePercent)) / 10_000);
}

function assertYear(year: number): void {
  if (year !== 2026) {
    throw new InpsContributionError(
      "UNSUPPORTED_INPS_YEAR",
      `Only contribution year 2026 is supported by the pinned INPS source pack; received ${year}.`,
    );
  }
}

export const EMPLOYEE_GENERAL_CONTRIBUTION_2026_AVAILABILITY = Object.freeze({
  year: 2026,
  supported: false as const,
  reason: INPS_CONTRIBUTIONS_2026.data.employeeGeneralProfile.reason,
  provenance: getItalyReferenceProvenance(INPS_CONTRIBUTIONS_2026),
});

export const EMPLOYEE_AGRICULTURAL_CONTRIBUTION_2026_AVAILABILITY = Object.freeze({
  year: 2026,
  supported: true as const,
  profiles: ["agricultural-worker-general"] as const,
  provenance: getItalyReferenceProvenance(INPS_CONTRIBUTIONS_2026),
});

export interface EmployeeAgriculturalContributionInput {
  readonly year: number;
  readonly profile: InpsEmployeeProfile | string;
  readonly contributionBaseEur: number;
  readonly partTimeHourlyRemunerationEur?: number;
}

export interface EmployeeAgriculturalContributionResult {
  readonly year: 2026;
  readonly profile: InpsEmployeeProfile;
  readonly contributionBaseEur: number;
  readonly totalFpldRatePercent: number;
  readonly workerFpldRatePercent: number;
  readonly employerFpldRatePercent: number;
  readonly employerFpldRateDerivation: "total-minus-worker";
  readonly workerContributionEur: number;
  readonly employerContributionEur: number;
  readonly totalFpldContributionEur: number;
  readonly dailyMinimumReferenceEur: number;
  readonly partTimeMinimumHourlyEur: number;
  readonly additionalOnePercentThresholdEur: number;
  readonly sourceReportedAnnualBaseMaximumReferenceEur: number;
  readonly assumptions: readonly string[];
  readonly provenance: ReturnType<typeof getItalyReferenceProvenance>;
}

export function calculateEmployeeAgriculturalContribution(
  input: EmployeeAgriculturalContributionInput,
): EmployeeAgriculturalContributionResult {
  assertYear(input.year);
  if (input.profile !== "agricultural-worker-general") {
    throw new InpsContributionError(
      "UNSUPPORTED_EMPLOYEE_PROFILE",
      "Only the pinned 2026 general agricultural-worker OTD/OTI profile is supported; other employee sectors are not inferred.",
    );
  }
  const pack = INPS_CONTRIBUTIONS_2026.data.employeeProfiles[input.profile];
  const baseCents = moneyToCents(input.contributionBaseEur);
  const ceilingCents = moneyToCents(pack.supportedBaseCeilingEur);
  if (baseCents > ceilingCents) {
    throw new InpsContributionError(
      "EMPLOYEE_BASE_ABOVE_BOUNDED_V1",
      `The bounded 2026 agricultural-worker v1 supports contribution bases through €${pack.supportedBaseCeilingEur}; the pinned INPS employee page reports an additional 1% above that threshold, so this primitive stops instead of applying a broader rule scope.`,
    );
  }
  if (input.partTimeHourlyRemunerationEur !== undefined) {
    const hourlyCents = moneyToCents(input.partTimeHourlyRemunerationEur);
    if (hourlyCents < moneyToCents(pack.partTimeMinimumHourlyEur)) {
      throw new InpsContributionError(
        "EMPLOYEE_PART_TIME_HOURLY_MINIMUM_NOT_MET",
        `The declared part-time hourly remuneration is below the pinned 2026 contribution minimum of €${pack.partTimeMinimumHourlyEur}.`,
      );
    }
  }
  const totalCents = applyRate(baseCents, pack.totalFpldRatePercent);
  const workerCents = applyRate(baseCents, pack.workerFpldRatePercent);
  const employerCents = totalCents - workerCents;
  return {
    year: 2026,
    profile: input.profile,
    contributionBaseEur: centsToMoney(baseCents),
    totalFpldRatePercent: pack.totalFpldRatePercent,
    workerFpldRatePercent: pack.workerFpldRatePercent,
    employerFpldRatePercent: pack.employerFpldRatePercent,
    employerFpldRateDerivation: pack.employerFpldRateDerivation,
    workerContributionEur: centsToMoney(workerCents),
    employerContributionEur: centsToMoney(employerCents),
    totalFpldContributionEur: centsToMoney(totalCents),
    dailyMinimumReferenceEur: pack.dailyMinimumReferenceEur,
    partTimeMinimumHourlyEur: pack.partTimeMinimumHourlyEur,
    additionalOnePercentThresholdEur: pack.additionalOnePercentThresholdEur,
    sourceReportedAnnualBaseMaximumReferenceEur: pack.sourceReportedAnnualBaseMaximumReferenceEur,
    assumptions: pack.supportedAssumptions,
    provenance: getItalyReferenceProvenance(INPS_CONTRIBUTIONS_2026),
  };
}

export interface ArtigianiCommerciantiInput {
  readonly year: number;
  readonly profile: InpsAutonomousProfile | string;
  readonly incomeEur: number;
  readonly contributionSeniority: InpsContributionSeniority | string;
  readonly role?: "owner-or-adult-collaborator" | string;
  readonly reduction?: "none" | string;
}

export interface ContributionBandBreakdown {
  readonly id: "minimum" | "first-band-excess" | "second-band";
  readonly baseEur: number;
  readonly ratePercent: number | null;
  readonly contributionEur: number;
  readonly rule: string;
}

export interface ArtigianiCommerciantiResult {
  readonly year: 2026;
  readonly profile: InpsAutonomousProfile;
  readonly contributionSeniority: InpsContributionSeniority;
  readonly declaredIncomeEur: number;
  readonly contributionBaseEur: number;
  readonly excludedAboveCeilingEur: number;
  readonly incomeMinimumEur: number;
  readonly firstBandUpperEur: number;
  readonly incomeMaximumEur: number;
  readonly totalContributionEur: number;
  readonly bands: readonly ContributionBandBreakdown[];
  readonly assumptions: readonly string[];
  readonly provenance: ReturnType<typeof getItalyReferenceProvenance>;
}

export function calculateArtigianiCommerciantiContribution(input: ArtigianiCommerciantiInput): ArtigianiCommerciantiResult {
  assertYear(input.year);
  if (input.profile !== "artigiano" && input.profile !== "commerciante") {
    throw new InpsContributionError(
      "UNSUPPORTED_ARTIGIANI_COMMERCIANTI_PROFILE",
      `Unsupported autonomous contribution profile: ${String(input.profile)}.`,
    );
  }
  if (input.contributionSeniority !== "before-1996" && input.contributionSeniority !== "from-1996") {
    throw new InpsContributionError(
      "UNSUPPORTED_CONTRIBUTION_SENIORITY",
      `Unsupported contribution seniority profile: ${String(input.contributionSeniority)}.`,
    );
  }
  if (input.role !== undefined && input.role !== "owner-or-adult-collaborator") {
    throw new InpsContributionError(
      "UNSUPPORTED_ARTIGIANI_COMMERCIANTI_ROLE",
      "Only the pinned standard owner/adult-collaborator path is supported; reduced-age and special collaborator paths are not inferred.",
    );
  }
  if (input.reduction !== undefined && input.reduction !== "none") {
    throw new InpsContributionError(
      "UNSUPPORTED_ARTIGIANI_COMMERCIANTI_REDUCTION",
      "Contribution reductions are outside the pinned 2026 source-pack subset and are not inferred.",
    );
  }

  const declaredCents = moneyToCents(input.incomeEur);
  const pack = INPS_CONTRIBUTIONS_2026.data.artigianiCommercianti;
  const minimumCents = moneyToCents(pack.incomeMinimumEur);
  const firstBandUpperCents = moneyToCents(pack.firstBandUpperEur);
  const maximumEur = pack.incomeMaximumEur[input.contributionSeniority];
  const maximumCents = moneyToCents(maximumEur);
  const cappedCents = Math.min(declaredCents, maximumCents);
  const contributionBaseCents = Math.max(cappedCents, minimumCents);
  const fixedMinimumCents = moneyToCents(pack.annualMinimumContributionEur[input.profile]);
  const rates = pack.ratesPercent[input.profile];

  const firstBandExcessBaseCents = Math.max(0, Math.min(contributionBaseCents, firstBandUpperCents) - minimumCents);
  const secondBandBaseCents = Math.max(0, contributionBaseCents - firstBandUpperCents);
  const firstBandContributionCents = applyRate(firstBandExcessBaseCents, rates.throughFirstBand);
  const secondBandContributionCents = applyRate(secondBandBaseCents, rates.aboveFirstBand);
  const totalCents = fixedMinimumCents + firstBandContributionCents + secondBandContributionCents;

  return {
    year: 2026,
    profile: input.profile,
    contributionSeniority: input.contributionSeniority,
    declaredIncomeEur: centsToMoney(declaredCents),
    contributionBaseEur: centsToMoney(contributionBaseCents),
    excludedAboveCeilingEur: centsToMoney(Math.max(0, declaredCents - maximumCents)),
    incomeMinimumEur: pack.incomeMinimumEur,
    firstBandUpperEur: pack.firstBandUpperEur,
    incomeMaximumEur: maximumEur,
    totalContributionEur: centsToMoney(totalCents),
    bands: [
      {
        id: "minimum",
        baseEur: pack.incomeMinimumEur,
        ratePercent: null,
        contributionEur: centsToMoney(fixedMinimumCents),
        rule: "Annual minimum contribution from INPS Circular 14/2026; it is not recomputed from a bare percentage.",
      },
      {
        id: "first-band-excess",
        baseEur: centsToMoney(firstBandExcessBaseCents),
        ratePercent: rates.throughFirstBand,
        contributionEur: centsToMoney(firstBandContributionCents),
        rule: `Income above €${pack.incomeMinimumEur} through €${pack.firstBandUpperEur}.`,
      },
      {
        id: "second-band",
        baseEur: centsToMoney(secondBandBaseCents),
        ratePercent: rates.aboveFirstBand,
        contributionEur: centsToMoney(secondBandContributionCents),
        rule: `Income above €${pack.firstBandUpperEur}, capped at the selected 2026 maximum.`,
      },
    ],
    assumptions: pack.supportedAssumptions,
    provenance: getItalyReferenceProvenance(INPS_CONTRIBUTIONS_2026),
  };
}

export interface GestioneSeparataInput {
  readonly year: number;
  readonly profile: GestioneSeparataProfessionalProfile | string;
  readonly incomeEur: number;
}

export interface GestioneSeparataResult {
  readonly year: 2026;
  readonly profile: GestioneSeparataProfessionalProfile;
  readonly declaredIncomeEur: number;
  readonly contributionBaseEur: number;
  readonly excludedAboveCeilingEur: number;
  readonly ratePercent: number;
  readonly totalContributionEur: number;
  readonly incomeMaximumEur: number;
  readonly incomeMinimumForFullYearCreditEur: number;
  readonly contributionAtFullYearCreditMinimumEur: number;
  readonly belowFullYearCreditMinimum: boolean;
  readonly rateComponentsPercent: Readonly<Record<string, number>> | null;
  readonly assumptions: readonly string[];
  readonly provenance: ReturnType<typeof getItalyReferenceProvenance>;
}

export function calculateGestioneSeparataContribution(input: GestioneSeparataInput): GestioneSeparataResult {
  assertYear(input.year);
  const pack = INPS_CONTRIBUTIONS_2026.data.gestioneSeparataProfessionisti;
  if (!(input.profile in pack.profiles)) {
    throw new InpsContributionError(
      "UNSUPPORTED_GESTIONE_SEPARATA_PROFILE",
      "Only the two professional profiles explicitly normalized from INPS Circular 8/2026 are supported; parasubordinate and special-sector profiles are not inferred.",
    );
  }
  const profile = input.profile as GestioneSeparataProfessionalProfile;
  const rule = pack.profiles[profile];
  const declaredCents = moneyToCents(input.incomeEur);
  const maximumCents = moneyToCents(pack.incomeMaximumEur);
  const baseCents = Math.min(declaredCents, maximumCents);
  const totalCents = applyRate(baseCents, rule.ratePercent);
  const fullYearCreditMinimumCents = moneyToCents(pack.incomeMinimumForFullYearCreditEur);
  const fullYearCreditContributionCents = applyRate(fullYearCreditMinimumCents, rule.ratePercent);

  return {
    year: 2026,
    profile,
    declaredIncomeEur: centsToMoney(declaredCents),
    contributionBaseEur: centsToMoney(baseCents),
    excludedAboveCeilingEur: centsToMoney(Math.max(0, declaredCents - maximumCents)),
    ratePercent: rule.ratePercent,
    totalContributionEur: centsToMoney(totalCents),
    incomeMaximumEur: pack.incomeMaximumEur,
    incomeMinimumForFullYearCreditEur: pack.incomeMinimumForFullYearCreditEur,
    contributionAtFullYearCreditMinimumEur: centsToMoney(fullYearCreditContributionCents),
    belowFullYearCreditMinimum: declaredCents < fullYearCreditMinimumCents,
    rateComponentsPercent: rule.componentsPercent ?? null,
    assumptions: [
      "professional Gestione Separata profile only",
      "the €18,808 figure is the 2026 minimum income for full-year contribution credit, not a contribution floor",
      "the contribution base is actual declared income capped at €122,295",
      "parasubordinate and special-sector profiles are outside this normalized source-pack subset",
    ],
    provenance: getItalyReferenceProvenance(INPS_CONTRIBUTIONS_2026),
  };
}
