import { calculateNationalGrossIrpef127 } from "./irpef-national-127";
import { assertItalyPinnedAnnualUse158 } from "../../reference-data/italy/freshness-158";

/** December 2025: 1.5% fixed + 75% of FOI Dec/Dec inflation; published against prior 2024 accruals.
 * Source ISTAT 16/01/2026 and art. 2120 Codice Civile:
 * https://www.istat.it/comunicato-stampa/prezzi-al-consumo-dicembre-2025/
 * https://servizi2.inps.it/servizi/Bussola/VisualizzaDoc.aspx?sVirtualURL=%2FCircolari%2FCircolare+numero+70+del+3-4-2007.htm
 */
export const TFR_DECEMBER_2025 = Object.freeze({
  year: 2025, revaluationRateBasisPointsMillionths: 2311148,
  ratePercent: 2.311148,
  source: "https://www.istat.it/comunicato-stampa/prezzi-al-consumo-dicembre-2025/",
  supportingCalculation: "https://www.ui.torino.it/news/trattamento-di-fine-rapporto-computo-dellaccantonamento-maturato-al-31-dicembre-2025",
});

const valid = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000_000;

export function calculateTfr134(input: {
  referenceYear: number;
  priorTfrCents: number;
  eligibleAnnualSalaryCents: number;
  serviceMonthsThisYear: number;
  officialDecemberIndexAvailable: boolean;
}) {
  if (input.referenceYear !== 2025 || !valid(input.priorTfrCents) || !valid(input.eligibleAnnualSalaryCents)
    || !Number.isInteger(input.serviceMonthsThisYear) || input.serviceMonthsThisYear < 1 || input.serviceMonthsThisYear > 12) {
    throw new Error("TFR134_UNSUPPORTED_YEAR_OR_INPUT");
  }
  assertItalyPinnedAnnualUse158("tfr-foi-december-2025", input.referenceYear);
  // User supplies only the remuneration actually accrued during the months worked.
  const annualAccrualCents = Math.round(input.eligibleAnnualSalaryCents / 13.5);
  if (!input.officialDecemberIndexAvailable || input.serviceMonthsThisYear !== 12) {
    return { state: "PARTIAL_MISSING_MONTHLY_INDEX" as const, annualAccrualCents,
      priorTfrCents: input.priorTfrCents, revaluationCents: null, grossTfrCents: null,
      reason: "La rivalutazione è disponibile soltanto per il 31 dicembre 2025; per cessazioni o periodi infrannuali manca il coefficiente ISTAT del mese.", source: TFR_DECEMBER_2025.source };
  }
  const revaluationCents = Math.round(input.priorTfrCents * TFR_DECEMBER_2025.ratePercent / 100);
  return {
    state: "DECEMBER_2025_REFERENCE" as const, priorTfrCents: input.priorTfrCents,
    annualAccrualCents, revaluationCents,
    grossTfrCents: input.priorTfrCents + annualAccrualCents + revaluationCents,
    source: TFR_DECEMBER_2025.source,
    limitations: "Quota teorica = retribuzione utile effettivamente maturata / 13,5. Esclude la riduzione contributiva 0,50%, anticipazioni, destinazioni a previdenza complementare, rivalutazioni nette e imposta sostitutiva sulla rivalutazione; non è un conteggio di liquidazione.",
  };
}

/** Separate tax illustration: IRPEF national gross average on user-verified historical annual reference income.
 * Exact TFR separate-tax law, credits and tax-office reassessment are outside this bounded model.
 */
export function estimateTfrTax135(input: {
  taxYear: number;
  eligibleTfrBaseCents: number;
  historicalAnnualReferenceIncomeCents: number | null;
  verifiedYearsOfHistory: number;
}) {
  if (!valid(input.eligibleTfrBaseCents) || input.taxYear !== 2025 && input.taxYear !== 2026) throw new Error("TFR135_INVALID_INPUT");
  if (!Number.isInteger(input.verifiedYearsOfHistory) || input.verifiedYearsOfHistory < 5
    || input.historicalAnnualReferenceIncomeCents === null) {
    return { state: "PARTIAL_HISTORY_MISSING" as const, taxCents: null, ratePercent: null,
      reason: "Indica un reddito annuo di riferimento documentato e almeno cinque anni di storico; senza questi dati non si inventa un'aliquota." };
  }
  const income = input.historicalAnnualReferenceIncomeCents;
  if (!valid(income) || income === 0) throw new Error("TFR135_INVALID_REFERENCE_INCOME");
  const calculation = calculateNationalGrossIrpef127(input.taxYear, income);
  const rate = calculation.grossNationalTaxCents / income;
  return {
    state: "ILLUSTRATIVE_TAX_ONLY" as const,
    eligibleTfrBaseCents: input.eligibleTfrBaseCents,
    ratePercent: rate * 100,
    taxCents: Math.round(input.eligibleTfrBaseCents * rate),
    source: calculation.sources,
    limitations: "Aliquota media illustrativa ricavata dall'IRPEF lorda nazionale sul reddito annuo di riferimento dichiarato. Non equivale alla tassazione separata effettiva del TFR, che può richiedere ricalcoli dell'Agenzia, detrazioni, base storica e tassazione distinta della rivalutazione.",
  };
}
