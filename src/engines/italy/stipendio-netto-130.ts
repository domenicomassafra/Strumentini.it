import { calculateEmployeeAgriculturalContribution } from "./inps-contributions";
import { calculateNationalGrossIrpef127 } from "./irpef-national-127";

/**
 * Bounded national-only estimate: 2026 agricultural FPLD (ordinary OTD/OTI).
 * A user must confirm RAL is also the already established FPLD base.
 * Other payroll contributions, surtaxes, deductions and tax credits are excluded.
 */
export function calculateStipendioNetto130(input: {
  taxYear: number;
  ralCents: number;
  payments: 12 | 13 | 14;
  profile: string;
  declaresFpldBaseEqualsRal: boolean;
}) {
  if (input.taxYear !== 2026 || input.profile !== "agricultural-worker-general" || !input.declaresFpldBaseEqualsRal) {
    throw new Error("NET130_UNSUPPORTED_PROFILE_OR_BASE");
  }
  if (!Number.isSafeInteger(input.ralCents) || input.ralCents < 0 || input.ralCents > 5_622_400) {
    throw new Error("NET130_INVALID_RAL");
  }
  if (![12, 13, 14].includes(input.payments)) throw new Error("NET130_INVALID_PAYMENTS");
  const inps = calculateEmployeeAgriculturalContribution({
    year: input.taxYear, profile: input.profile, contributionBaseEur: input.ralCents / 100,
  });
  const workerContributionsCents = Math.round(inps.workerContributionEur * 100);
  const employerContributionsCents = Math.round(inps.employerContributionEur * 100);
  const taxableCents = input.ralCents - workerContributionsCents;
  const irpef = calculateNationalGrossIrpef127(input.taxYear, taxableCents);
  const nationalIrpefCents = irpef.grossNationalTaxCents;
  const annualNetCents = taxableCents - nationalIrpefCents;
  const installmentsCents = Array.from({ length: input.payments }, (_, i) =>
    Math.trunc(annualNetCents / input.payments) + (i < annualNetCents % input.payments ? 1 : 0));
  return {
    taxYear: 2026 as const, profile: input.profile, ralCents: input.ralCents,
    workerContributionsCents, employerContributionsCents,
    taxableCents, nationalIrpefCents, annualNetCents, installmentsCents,
    sourceInps: inps.provenance, sourceIrpef: irpef.sources,
    limitations: "Simulazione nazionale 2026 OTD/OTI ordinario: RAL dichiarata uguale alla base FPLD; imposta lorda nazionale; non comprende detrazioni, bonus, addizionali, altre trattenute e situazioni contrattuali particolari.",
  };
}
