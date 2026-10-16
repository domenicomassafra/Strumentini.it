import { calculateNationalGrossIrpef127 } from "./irpef-national-127";

/** Bounded RAL scenario: the contribution percentage comes from the user, not an assumed INPS profile. */
export function calculateStipendioNetto13(input: {
  taxYear: number;
  ralCents: number;
  contributionRatePercent: string;
  paymentsPerYear: 12 | 13 | 14;
}) {
  if (!Number.isSafeInteger(input.ralCents) || input.ralCents < 0 || input.ralCents > 100_000_000_000) {
    throw new Error("NET13_INVALID_RAL");
  }
  if (![12, 13, 14].includes(input.paymentsPerYear)) throw new Error("NET13_INVALID_PAYMENTS");
  const match = /^(0|[1-9]\d{0,2})(?:[.,](\d{1,2}))?$/u.exec(input.contributionRatePercent.trim());
  if (!match) throw new Error("NET13_INVALID_RATE");
  const rateBasisPoints = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  if (rateBasisPoints > 10_000) throw new Error("NET13_INVALID_RATE");
  const employeeContributionsCents = Number((BigInt(input.ralCents) * BigInt(rateBasisPoints) + 5_000n) / 10_000n);
  const taxableIncomeCents = input.ralCents - employeeContributionsCents;
  const nationalIrpef = calculateNationalGrossIrpef127(input.taxYear, taxableIncomeCents);
  const annualNetBeforeUnmodeledTaxesCents = taxableIncomeCents - nationalIrpef.grossNationalTaxCents;
  return {
    taxYear: nationalIrpef.taxYear,
    ralCents: input.ralCents,
    employeeContributionRatePercent: (rateBasisPoints / 100).toFixed(2),
    employeeContributionsCents,
    taxableIncomeCents,
    nationalGrossIrpefCents: nationalIrpef.grossNationalTaxCents,
    irpefLines: nationalIrpef.lines,
    annualNetBeforeUnmodeledTaxesCents,
    paymentsPerYear: input.paymentsPerYear,
    indicativePaymentCents: Math.round(annualNetBeforeUnmodeledTaxesCents / input.paymentsPerYear),
    sources: nationalIrpef.sources,
    limitations: "Stima semplificata: aliquota contributiva ipotizzata dall'utente; esclusi detrazioni/crediti, addizionali regionali e comunali, trattamento integrativo, premi, benefit e condizioni individuali. L'importo non coincide necessariamente col netto in busta paga.",
  };
}
