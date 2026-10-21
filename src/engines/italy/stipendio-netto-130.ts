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
  const partialNationalResidualCents = taxableCents - nationalIrpefCents;
  const partialInstallmentsCents = Array.from({ length: input.payments }, (_, i) =>
    Math.trunc(partialNationalResidualCents / input.payments)
    + (i < partialNationalResidualCents % input.payments ? 1 : 0));
  return {
    state: "PARTIAL_NATIONAL_ONLY" as const,
    taxYear: 2026 as const, profile: input.profile, ralCents: input.ralCents,
    workerContributionsCents, employerContributionsCents,
    taxableCents, nationalIrpefCents, partialNationalResidualCents, partialInstallmentsCents,
    // Without current local taxes, deductions and CCNL the actual payroll net is unknown.
    modeledAnnualNetCents: null,
    missingCoverage: ["regione", "comune", "CCNL", "detrazioni", "altri contributi", "bonus"] as const,
    sourceInps: inps.provenance, sourceIrpef: irpef.sources,
    limitations: "Solo residuo nazionale parziale 2026 OTD/OTI ordinario: base FPLD dichiarata uguale alla RAL. Regione, comune e CCNL non dichiarati; detrazioni, addizionali, bonus, altre trattenute e situazioni individuali restano sconosciuti, non sono zero. Non è il netto annuo in busta paga.",
  };
}
