import { calculateNationalGrossIrpef127 } from "./irpef-national-127";
import { calculateIrpefComponents128 } from "./irpef-components-128";

/** INPS, circolare 46 del 20 febbraio 2025, §2: OTD/OTI FPLD ordinari, quota dipendente 8,84%. */
export const SALARY_13_INPS_2025 = Object.freeze({
  authority: "INPS", provision: "Circolare 46/2025, §2 — operai agricoli OTD/OTI, quota FPLD lavoratore 8,84%",
  url: "https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2025/02/Circolare_14840/Allegati/15918_Circolare-numero-46-del-20-02-2025.pdf",
  version: "2025-02-20", workerRateBasisPoints: 884,
  // A deliberately narrow subset, avoiding the additional 1% and annual ceiling cases.
  maxBaseCents: 5_000_000,
});

/** Indicative arithmetic bridge, not an INPS/payroll or personal tax assessment. */
export interface SalaryNet13Input {
  readonly taxYear: number;
  readonly ralCents: number;
  /** The employee's own payslip-derived assumption for the declared-rate mode. */
  readonly employeeRate: string;
  readonly installments: 12 | 13 | 14;
  readonly contributionProfile?: "declared-rate" | "agricultural-2025-fpld";
  /** The user has checked that annual RAL equals their pension contribution base. */
  readonly confirmsContributionBase?: boolean;
  readonly employeeFullYearConfirmed?: boolean;
  readonly region?: "puglia" | "unknown";
  readonly municipality?: "bari" | "unknown";
}

export function estimateSalaryNet13(input: SalaryNet13Input) {
  if (!Number.isSafeInteger(input.ralCents) || input.ralCents < 0 || input.ralCents > 100_000_000_000) {
    throw new Error("SALARY13_RAL: importo in centesimi non valido");
  }
  if (![12, 13, 14].includes(input.installments)) throw new Error("SALARY13_INSTALLMENTS");
  const contributionProfile = input.contributionProfile ?? "declared-rate";
  let basisPoints: number;
  if (contributionProfile === "agricultural-2025-fpld") {
    if (input.taxYear !== 2025 || !input.confirmsContributionBase || input.ralCents > SALARY_13_INPS_2025.maxBaseCents) {
      throw new Error("SALARY13_INPS_SCOPE: solo 2025, base FPLD=RAL confermata, fino a 50.000 €");
    }
    basisPoints = SALARY_13_INPS_2025.workerRateBasisPoints;
  } else if (contributionProfile === "declared-rate") {
    const value = /^(0|[1-9]\d{0,2})(?:[.,](\d{1,2}))?$/u.exec(input.employeeRate.trim());
    if (!value) throw new Error("SALARY13_RATE: inserisci una percentuale tra 0 e 100 con due decimali");
    basisPoints = Number(value[1]) * 100 + Number((value[2] ?? "").padEnd(2, "0") || "0");
    if (basisPoints > 10_000) throw new Error("SALARY13_RATE: oltre 100%");
  } else throw new Error("SALARY13_INPS_SCOPE: profilo non supportato");

  const contributionsCents = Number((BigInt(input.ralCents) * BigInt(basisPoints) + 5_000n) / 10_000n);
  const taxableCents = input.ralCents - contributionsCents;
  const nationalTax = calculateNationalGrossIrpef127(input.taxYear, taxableCents);
  const partialAnnualNetCents = taxableCents - nationalTax.grossNationalTaxCents;
  // #69/#128 is the one source-backed authority for the supported final-tax subset.
  // An unknown component stays unknown, never silently interpreted as zero.
  const modeledTax = calculateIrpefComponents128({
    taxYear: input.taxYear,
    taxableIncomeCents: taxableCents,
    region: input.region ?? "unknown",
    municipality: input.municipality ?? "unknown",
    employeeFullYearConfirmed: Boolean(input.employeeFullYearConfirmed && input.confirmsContributionBase),
  });
  const finalModeledTaxCents = modeledTax.finalModeledTaxCents;
  const modeledAnnualNetCents = finalModeledTaxCents === null ? null : taxableCents - finalModeledTaxCents;
  return {
    taxYear: nationalTax.taxYear,
    ralCents: input.ralCents,
    contributionRate: (basisPoints / 100).toFixed(2),
    contributionProfile,
    contributionSource: contributionProfile === "agricultural-2025-fpld" ? SALARY_13_INPS_2025 : null,
    contributionsCents,
    taxableCents,
    nationalTaxBands: nationalTax.lines,
    grossNationalTaxCents: nationalTax.grossNationalTaxCents,
    partialAnnualNetCents,
    modeledTaxComponents: modeledTax.components,
    unsupportedTaxComponents: modeledTax.unsupported,
    finalModeledTaxCents,
    modeledAnnualNetCents,
    installments: input.installments,
    indicativeInstallmentCents: Math.round(partialAnnualNetCents / input.installments),
    indicativeModeledInstallmentCents: modeledAnnualNetCents === null ? null : Math.round(modeledAnnualNetCents / input.installments),
    sources: nationalTax.sources,
    assumptions: "Stima sulle sole voci esplicitate: la percentuale contributiva non determina il netto in busta paga. I contributi dichiarati o la sola quota FPLD agricola non comprendono tutte le trattenute. Altre detrazioni, carichi familiari, crediti, trattamento integrativo, benefit, conguagli, contributi ulteriori e condizioni individuali sono esclusi (non pari a zero). Non è un cedolino personale.",
  };
}
