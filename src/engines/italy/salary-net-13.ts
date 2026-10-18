import { calculateNationalGrossIrpef127 } from "./irpef-national-127";

/** Indicative arithmetic bridge, not an INPS/payroll or personal tax assessment. */
export interface SalaryNet13Input {
  readonly taxYear: number;
  readonly ralCents: number;
  /** The employee's assumption, never an automatic INPS rate. */
  readonly employeeRate: string;
  readonly installments: 12 | 13 | 14;
}

export function estimateSalaryNet13(input: SalaryNet13Input) {
  if (!Number.isSafeInteger(input.ralCents) || input.ralCents < 0 || input.ralCents > 100_000_000_000) {
    throw new Error("SALARY13_RAL: importo in centesimi non valido");
  }
  if (![12, 13, 14].includes(input.installments)) throw new Error("SALARY13_INSTALLMENTS");
  const value = /^(0|[1-9]\d{0,2})(?:[.,](\d{1,2}))?$/u.exec(input.employeeRate.trim());
  if (!value) throw new Error("SALARY13_RATE: inserisci una percentuale tra 0 e 100 con due decimali");
  const basisPoints = Number(value[1]) * 100 + Number((value[2] ?? "").padEnd(2, "0") || "0");
  if (basisPoints > 10_000) throw new Error("SALARY13_RATE: oltre 100%");

  const contributionsCents = Number((BigInt(input.ralCents) * BigInt(basisPoints) + 5_000n) / 10_000n);
  const taxableCents = input.ralCents - contributionsCents;
  const nationalTax = calculateNationalGrossIrpef127(input.taxYear, taxableCents);
  const partialAnnualNetCents = taxableCents - nationalTax.grossNationalTaxCents;
  return {
    taxYear: nationalTax.taxYear,
    ralCents: input.ralCents,
    contributionRate: (basisPoints / 100).toFixed(2),
    contributionsCents,
    taxableCents,
    nationalTaxBands: nationalTax.lines,
    grossNationalTaxCents: nationalTax.grossNationalTaxCents,
    partialAnnualNetCents,
    installments: input.installments,
    indicativeInstallmentCents: Math.round(partialAnnualNetCents / input.installments),
    sources: nationalTax.sources,
    assumptions: "Stima parziale nazionale: il contributo dipendente è una percentuale ipotizzata da te e non determina il netto in busta paga. Mancano detrazioni e crediti, addizionali comunali/regionali, trattamento integrativo, benefit, conguagli e condizioni individuali.",
  };
}
