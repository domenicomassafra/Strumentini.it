/**
 * #117 donor-first official tax-documentation PDF snapshots, narrow 2025 IVA.
 *
 * Crucial temporal boundary: the full, verified D.P.R. 633/1972 Table A
 * publication at def.giustiziatributaria.gov.it explicitly says effective
 * 13/12/2025–01/01/2027. It does NOT prove Table A's exact applicability from
 * January through 12 December 2025. Thus this module refuses those dates,
 * even though Article 16 (22/4/5/10 categories) has a broader 2016–2026 span.
 *
 * This is NOT an automatic goods/services tax classifier. A human must declare
 * that ALL the detailed legal conditions of exactly one printed article/row
 * apply and that the operation is taxable rather than exempt or special regime.
 * References to other regimes, exemptions, reverse charge, place of supply or
 * art.34 special agriculture are not determined by this module.
 */
import { calculateVat126 } from "../../engines/italy/vat-126";
import { assertItalyPinnedAnnualUse158 } from "./freshness-158";

export interface AnnualVatOfficialPdfSource117 {
  readonly authority: "Ministero dell'Economia e delle Finanze — Documentazione Economica e Finanziaria";
  readonly title: string;
  readonly url: string;
  readonly artifactPath: string;
  readonly sha256: `sha256:${string}`;
  readonly expectedPages: number;
  readonly printedEffectiveFrom: string;
  readonly printedEffectiveToExclusive: string;
}

export type AnnualVatCategoryId117 =
  | "art16-ordinary-taxable"
  | "tabA-ii-3-fresh-milk"
  | "tabA-iibis-1bis-fresh-herbs"
  | "tabA-iii-121-serving-food-drink";

export interface AnnualVatLegalCategory117 {
  readonly id: AnnualVatCategoryId117;
  readonly ratePercent: 4 | 5 | 10 | 22;
  readonly legalReference: string;
  readonly exactScopeToDeclare: string;
  readonly exclusions: string;
}

const art16Source: AnnualVatOfficialPdfSource117 = {
  authority: "Ministero dell'Economia e delle Finanze — Documentazione Economica e Finanziaria",
  title: "D.P.R. 633/1972 Articolo 16, Aliquote dell'imposta, versione 01/01/2016–01/01/2027",
  url: "https://def.giustiziatributaria.gov.it/DocTribFrontend/executePrintArticolo.do?FROM_SEARCH=true&codiceOrdinamento=0000000000000160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000&id=%7BA4A3F97F-082C-4930-AE96-32738FA78FE7%7D&idAttoNormativo=%7B75A4827C-3766-4ECC-9C45-00C8D6CDC552%7D&numeroArticolo=Articolo+16",
  artifactPath: "quality/reference-data/italy/artifacts/117-fiscal-annual/def-dpr633-article16-2016-2026.pdf",
  sha256: "sha256:e509df3a14694174938c2f4a6ebc21ae087ad222a41fa53f30c7d845baa4e8bc",
  expectedPages: 1,
  printedEffectiveFrom: "2016-01-01",
  printedEffectiveToExclusive: "2027-01-01",
};

const annexSource: AnnualVatOfficialPdfSource117 = {
  authority: "Ministero dell'Economia e delle Finanze — Documentazione Economica e Finanziaria",
  title: "D.P.R. 633/1972 Tabella A integrale, versione 13/12/2025–01/01/2027",
  url: "https://def.giustiziatributaria.gov.it/DocTribFrontend/executePrintArticolo.do?FROM_SEARCH=true&codiceOrdinamento=0010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000&id=%7BFD8245B8-AD26-42C5-9BD2-17E636B89FDD%7D&idAttoNormativo=%7B75A4827C-3766-4ECC-9C45-00C8D6CDC552%7D&numeroArticolo=Tabella+A",
  artifactPath: "quality/reference-data/italy/artifacts/117-fiscal-annual/def-dpr633-tabella-a-2025-12-13-full.pdf",
  sha256: "sha256:a29e69bd448a1355e462bb301f7166b0c7563cd0b338ccbad698f3fe051db412",
  expectedPages: 13,
  printedEffectiveFrom: "2025-12-13",
  printedEffectiveToExclusive: "2027-01-01",
};

/** These are examples of exact *user-declared* categories, NOT a rate finder. */
export const ANNUAL_VAT_2025_WINDOW_117 = Object.freeze({
  taxYear: 2025,
  validFrom: "2025-12-13",
  validTo: "2025-12-31",
  status: "VERIFIED_LAST_19_DAYS_ONLY" as const,
  sources: [art16Source, annexSource] as const,
  categories: [
    {
      id: "art16-ordinary-taxable", ratePercent: 22, legalReference: "DPR633/1972 art.16 c.1",
      exactScopeToDeclare: "Operazione imponibile IVA italiana ordinaria non soggetta a esenzioni, aliquote ridotte, regimi speciali o altre deroghe.",
      exclusions: "L'applicabilità ordinaria non è dedotta. Occorre aver escluso autonomamente ogni alternativa, incluse operazioni fuori campo, regimi speciali, inversione contabile e art.34.",
    },
    {
      id: "tabA-ii-3-fresh-milk", ratePercent: 4, legalReference: "Tabella A parte II n.3",
      exactScopeToDeclare: "Latte fresco non concentrato né zuccherato, destinato all'alimentazione, confezionato per la vendita al minuto e pastorizzato o sottoposto agli altri trattamenti previsti dalle leggi sanitarie.",
      exclusions: "Non si applica a latte generico, latte in polvere, preparati misti a base di latte, prodotti non alimentari o operazioni nel regime speciale agricolo dell'art.34.",
    },
    {
      id: "tabA-iibis-1bis-fresh-herbs", ratePercent: 5, legalReference: "Tabella A parte II-bis n.1-bis",
      exactScopeToDeclare: "Basilico, rosmarino o salvia freschi, oppure origano a rametti o sgranato per uso alimentare, incluse le specifiche varianti di piante vive indicate nella voce della tabella.",
      exclusions: "Sono escluse erbe essiccate generiche, piante diverse da quelle elencate e miscele preparate non verificate.",
    },
    {
      id: "tabA-iii-121-serving-food-drink", ratePercent: 10, legalReference: "Tabella A parte III n.121",
      exactScopeToDeclare: "Somministrazione imponibile di alimenti e bevande, inclusi i distributori automatici e i contratti di servizi comprendenti la somministrazione che soddisfano le condizioni della voce.",
      exclusions: "Non si applica automaticamente a supermercati o prodotti alimentari al dettaglio; le mense della parte II n.37 possono invece rientrare nel 4%; occorre escludere altre esenzioni e regimi speciali.",
    },
  ] as const satisfies readonly AnnualVatLegalCategory117[],
});

export interface AnnualVatWindowInput117 {
  readonly taxYear: number;
  /** Explicit ISO Gregorian local transaction date; only verified window. */
  readonly transactionDate: string;
  /** Exact printed legal row selected by a human, not free-form guessed product. */
  readonly categoryId: string;
  readonly confirmsExactLegalCategory: boolean;
  readonly confirmsTaxableAndNotExempt: boolean;
}

/** Returns only a conditionally applicable source-backed rate, never identity of goods from free text. */
export function getVerifiedAnnualVatCategory117(input: AnnualVatWindowInput117) {
  if (input.taxYear !== 2025) throw new Error("VAT117_UNSUPPORTED_YEAR: only tax year 2025 partial source has been pinned");
  assertItalyPinnedAnnualUse158("vat-2025-limited-window", input.taxYear);
  if (typeof input.transactionDate !== "string" || !/^2025-12-(?:1[3-9]|2\d|3[01])$/u.test(input.transactionDate)) {
    throw new Error("VAT117_UNSUPPORTED_DATE: exact Annex A version only proven 13–31 December 2025");
  }
  if (input.confirmsExactLegalCategory !== true || input.confirmsTaxableAndNotExempt !== true) {
    throw new Error("VAT117_UNCONFIRMED_SCOPE: declare all precise legal conditions and taxable/nonexempt status");
  }
  const category = ANNUAL_VAT_2025_WINDOW_117.categories.find((row) => row.id === input.categoryId);
  if (!category) throw new Error("VAT117_UNLISTED_CATEGORY: no legal classification inferred or extrapolated");
  return {
    ...category,
    taxYear: 2025 as const,
    transactionDate: input.transactionDate,
    categoryOrigin: "USER_CONFIRMED_EXACT_LEGAL_SCOPE" as const,
    windowStatus: ANNUAL_VAT_2025_WINDOW_117.status,
    sources: ANNUAL_VAT_2025_WINDOW_117.sources,
    limitations: "User-declared exact category, not an automatic legal classifier or VAT transaction classification; no exemptions, special regimes, art.34 applicability, reverse charge, territoriality or legal advice inferred.",
  };
}

/** Real local #126 integer-cent arithmetic, without changing global #126 blocked preset gate. */
export function calculateVerifiedAnnualVatWindow117(input: AnnualVatWindowInput117 & {
  readonly operation: "add" | "scorporo";
  readonly amountCents: number;
}) {
  const chosen = getVerifiedAnnualVatCategory117(input);
  const result = calculateVat126({ operation: input.operation, amountCents: input.amountCents,
    rate: { kind: "custom", percent: String(chosen.ratePercent) } });
  return {
    ...result,
    ratePercent: chosen.ratePercent,
    ratePercentExactText: result.ratePercent,
    status: "CONDITIONAL_2025_WINDOW_ESTIMATE" as const,
    taxYear: chosen.taxYear,
    transactionDate: chosen.transactionDate,
    categoryId: chosen.id,
    categoryOrigin: chosen.categoryOrigin,
    legalReference: chosen.legalReference,
    exactScopeToDeclare: chosen.exactScopeToDeclare,
    sources: chosen.sources,
    limitations: `${chosen.limitations} ${result.limitations}`,
  };
}
