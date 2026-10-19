import { calculateNationalGrossIrpef127 } from "./irpef-national-127";

/**
 * Source-scoped illustrative IRPEF components. The source tables cover ONLY
 * 2025 Puglia / Bari and full-year ordinary employment deduction in 2025.
 * They cannot establish an individual's eligibility or net final tax.
 */
export const IRPEF_128_COVERAGE = Object.freeze({
  deduction: { year: 2025, case: "Full-year employee, full-period art.13(1), reported total income equals taxable income; no special conditions", source: {
    authority: "MEF — Documentazione economica e finanziaria", provision: "DPR 917/1986, art. 13 commi 1 e 1-bis, in vigore dal 1/1/2025",
    url: "https://def.finanze.it/DocTribFrontend/getAttoNormativoDetail.do?ACTION=getArticolo&codiceOrdinamento=0000000000000130000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000&id=%7B31D694E8-4398-4030-873B-FEAF5A6647F9%7D",
    version: "2025-01-01",
  } },
  region: { year: 2025, code: "puglia", source: {
    authority: "Dipartimento delle Finanze", provision: "Addizionale regionale Puglia — aliquote anno 2025, pubblicate 08/04/2025",
    url: "https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?anno=2025&reg=14",
    version: "2025-04-08",
  } },
  municipality: { year: 2025, code: "bari", source: {
    authority: "Dipartimento delle Finanze", provision: "Comune di Bari (A662) — 2025, conferma delibera 42/2012, pubblicazione 20/12/2025",
    url: "https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/risultato.htm?anno=9999&cc=A662&pr=BA&r=1",
    version: "2025-12-20",
  } },
});

/** Both surtaxes require national IRPEF due after deductions/credits; 2025 provisions. */
export const IRPEF_128_LIABILITY_SOURCES = Object.freeze([
  { provision: "D.Lgs. 446/1997, art. 50 comma 2 — presupposto addizionale regionale",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1997;446~art50!vig=2025-12-31" },
  { provision: "D.Lgs. 360/1998, art. 1 comma 4 — presupposto addizionale comunale",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1998;360~art1!vig=2025-12-31" },
]);

export type FiscalComponent128 = {
  id: "employee-deduction" | "puglia-regional" | "bari-municipal";
  cents: number;
  source: { readonly authority: string; readonly provision: string; readonly url: string; readonly version: string };
  breakdown: readonly { description: string; taxableCents: number; rateBasisPoints?: number; taxCents: number }[];
};

function roundHalfUp(numerator: bigint, denominator: bigint): number {
  return Number((numerator + denominator / 2n) / denominator);
}

/** Form 730/2026 instructions: calculate ratio with four decimal digits before applying deduction. */
function employeeDeduction2025(income: number): number {
  const euro = 100;
  if (income <= 15_000 * euro) return 195_500;
  if (income > 50_000 * euro) return 0;
  const low = income <= 28_000 * euro;
  const upper = low ? 28_000 * euro : 50_000 * euro;
  const width = low ? 13_000 * euro : 22_000 * euro;
  const ratioFourPlaces = Math.floor((upper - income) * 10_000 / width);
  const computed = low ? 191_000 + roundHalfUp(119_000n * BigInt(ratioFourPlaces), 10_000n)
    : roundHalfUp(191_000n * BigInt(ratioFourPlaces), 10_000n);
  return computed + (income > 25_000 * euro && income <= 35_000 * euro ? 6_500 : 0);
}

function regionalPuglia2025(income: number) {
  const brackets = [
    { upTo: 1_500_000, rate: 133 }, { upTo: 2_800_000, rate: 143 },
    { upTo: 5_000_000, rate: 163 }, { upTo: null, rate: 185 },
  ];
  let start = 0;
  let accumulated = 0;
  let rounded = 0;
  const breakdown = brackets.map(({ upTo, rate }) => {
    const taxableCents = Math.max(0, Math.min(income, upTo ?? income) - start);
    accumulated += taxableCents * rate;
    const next = Math.round(accumulated / 10_000);
    const taxCents = next - rounded;
    rounded = next;
    start = upTo ?? income;
    return { description: upTo === null ? "Oltre 50.000 €" : `Fino a ${upTo / 100} €`, taxableCents, rateBasisPoints: rate, taxCents };
  });
  return { cents: rounded, breakdown };
}

export function calculateIrpefComponents128(input: {
  taxYear: number;
  taxableIncomeCents: number;
  region: "puglia" | "unknown";
  municipality: "bari" | "unknown";
  employeeFullYearConfirmed: boolean;
}) {
  const national = calculateNationalGrossIrpef127(input.taxYear, input.taxableIncomeCents);
  const components: FiscalComponent128[] = [];
  const unsupported: string[] = [];
  const supportedYear = input.taxYear === 2025;
  if (supportedYear) assertItalyPinnedAnnualUse158("irpef-components-bari-puglia-2025", input.taxYear);
  if (supportedYear && input.employeeFullYearConfirmed) {
    const cents = employeeDeduction2025(input.taxableIncomeCents);
    components.push({ id: "employee-deduction", cents: Math.min(cents, national.grossNationalTaxCents),
      source: IRPEF_128_COVERAGE.deduction.source,
      breakdown: [{ description: "Detrazione lavoro dipendente (anno intero), limitata all'imposta lorda", taxableCents: input.taxableIncomeCents, taxCents: Math.min(cents, national.grossNationalTaxCents) }] });
  } else unsupported.push("Detrazione lavoro: manca anno 2025 o conferma esplicita delle condizioni; non calcolata.");
  const deduction = components.find((c) => c.id === "employee-deduction");
  // Unknown deduction is not zero. Gross zero, unlike missing conditions, proves
  // no national liability even without a selected deduction.
  const nationalAfterSelectedDeductionCents = deduction ? national.grossNationalTaxCents - deduction.cents
    : national.grossNationalTaxCents === 0 ? 0 : null;
  if (supportedYear && input.region === "puglia") {
    if (nationalAfterSelectedDeductionCents === null) {
      unsupported.push("Addizionale regionale: IRPEF netta non determinata senza conferma delle condizioni della detrazione; non calcolata.");
    } else {
      const regional = nationalAfterSelectedDeductionCents === 0
        ? { cents: 0, breakdown: [{ description: "Non dovuta: IRPEF nazionale azzerata nella simulazione", taxableCents: input.taxableIncomeCents, taxCents: 0 }] }
        : regionalPuglia2025(input.taxableIncomeCents);
      components.push({ id: "puglia-regional", cents: regional.cents, source: IRPEF_128_COVERAGE.region.source, breakdown: regional.breakdown });
    }
  } else unsupported.push("Addizionale regionale: combinazione regione/anno non coperta.");
  if (supportedYear && input.region === "puglia" && input.municipality === "bari") {
    if (nationalAfterSelectedDeductionCents === null) {
      unsupported.push("Addizionale comunale: IRPEF netta non determinata senza conferma delle condizioni della detrazione; non calcolata.");
    } else {
      const exempt = nationalAfterSelectedDeductionCents === 0 || input.taxableIncomeCents <= 1_500_000;
      const cents = exempt ? 0 : roundHalfUp(BigInt(input.taxableIncomeCents) * 80n, 10_000n);
      components.push({ id: "bari-municipal", cents, source: IRPEF_128_COVERAGE.municipality.source,
        breakdown: [{ description: nationalAfterSelectedDeductionCents === 0
          ? "Non dovuta: IRPEF nazionale azzerata nella simulazione"
          : "Esenzione integrale per reddito fino a 15.000 €; altrimenti 0,8% dell'intero imponibile",
          taxableCents: input.taxableIncomeCents, rateBasisPoints: exempt ? 0 : 80, taxCents: cents }] });
    }
  } else unsupported.push("Addizionale comunale: combinazione Comune/anno non coperta.");
  const surtaxes = components.filter((c) => c.id !== "employee-deduction").reduce((n, c) => n + c.cents, 0);
  const completeSourceCoverage = unsupported.length === 0
    && components.length === 3 && nationalAfterSelectedDeductionCents !== null;
  return {
    status: unsupported.length ? "PARTIAL" as const : "SUPPORTED_COMPONENTS_ONLY" as const,
    national,
    components,
    unsupported,
    nationalAfterSelectedDeductionCents,
    selectedComponentsEstimateCents: nationalAfterSelectedDeductionCents === null ? null : nationalAfterSelectedDeductionCents + surtaxes,
    // A final modeled value is valid only when all three selected components
    // have source-backed coverage. A partial sum must never look like a final tax.
    finalModeledTaxCents: completeSourceCoverage ? nationalAfterSelectedDeductionCents! + surtaxes : null,
    limitations: "Simulazione di sole componenti supportate: non è l'IRPEF personale dovuta. Reddito complessivo, reddito imponibile e giorni di lavoro possono differire. Esclusi altre detrazioni, carichi familiari, bonus, crediti, acconti e condizioni speciali.",
  };
}
import { assertItalyPinnedAnnualUse158 } from "../../reference-data/italy/freshness-158";
