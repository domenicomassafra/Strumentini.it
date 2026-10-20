/**
 * Narrow official-source excerpts for independent fiscal consumers.
 * This is NOT the complete #117 annual pack: IVA and forfettario remain blocked.
 * The 2026 brackets compose the 2025 TUIR replacement with the 2026 amendment.
 */
import { selectFiscalRevision409 } from "./fiscal-revisions-409";
export interface FiscalSource117 {
  readonly authority: "Normattiva" | "Agenzia delle Entrate";
  readonly url: string;
  readonly artifactPath: string;
  readonly sha256: `sha256:${string}`;
}

export interface AnnualIrpefBand117 {
  /** Upper inclusive taxable-income bound in cents; null = unbounded. */
  readonly upToCents: number | null;
  readonly rateBasisPoints: number;
}

export interface AnnualIrpefExcerpt117 {
  readonly taxYear: 2025 | 2026;
  readonly revisionId: string;
  readonly checkedAt: string;
  readonly amendmentKind: "YEAR_BASELINE" | "RETROACTIVE_AMENDMENT";
  readonly supersedesRevisionId: string | null;
  readonly reviewOwner: string | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly status: "VERIFIED_IRPEF_SUBSET_ONLY";
  readonly bands: readonly AnnualIrpefBand117[];
  readonly sources: readonly FiscalSource117[];
}

const law2025: FiscalSource117 = Object.freeze({
  authority: "Normattiva",
  url: "https://www.normattiva.it/eli/stato/LEGGE/2024/12/30/207/ORIGINAL",
  artifactPath: "quality/reference-data/italy/artifacts/117-fiscal-annual/normattiva-legge-207-2024-original.html",
  sha256: "sha256:6c0ea88f5ea8abd7f2c709d94804095dd0a175ed9f4921a5a9b0e2e35a2517b5",
});
const amendment2026: FiscalSource117 = Object.freeze({
  authority: "Normattiva",
  url: "https://www.normattiva.it/eli/stato/LEGGE/2025/12/30/199/CONSOLIDATED",
  artifactPath: "quality/reference-data/italy/artifacts/117-fiscal-annual/normattiva-legge-199-2025-consolidated.html",
  sha256: "sha256:5ac25beddb71144367f68f3262f8da33fae195c7ce969421d04c5f69c8078f85",
});

export const VERIFIED_IRPEF_EXCERPTS_117: readonly AnnualIrpefExcerpt117[] = Object.freeze(([
  {
    taxYear: 2025, revisionId: "IRPEF-2025-117-v1", checkedAt: "2026-10-06",
    amendmentKind: "YEAR_BASELINE", supersedesRevisionId: null, reviewOwner: null,
    effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31", status: "VERIFIED_IRPEF_SUBSET_ONLY",
    bands: Object.freeze([{ upToCents: 2_800_000, rateBasisPoints: 2300 }, { upToCents: 5_000_000, rateBasisPoints: 3500 },
      { upToCents: null, rateBasisPoints: 4300 }].map((row) => Object.freeze(row))),
    sources: Object.freeze([law2025]),
  },
  {
    taxYear: 2026, revisionId: "IRPEF-2026-117-v1", checkedAt: "2026-10-06",
    amendmentKind: "YEAR_BASELINE", supersedesRevisionId: null, reviewOwner: null,
    effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", status: "VERIFIED_IRPEF_SUBSET_ONLY",
    bands: Object.freeze([{ upToCents: 2_800_000, rateBasisPoints: 2300 }, { upToCents: 5_000_000, rateBasisPoints: 3300 },
      { upToCents: null, rateBasisPoints: 4300 }].map((row) => Object.freeze(row))),
    sources: Object.freeze([law2025, amendment2026]),
  },
] satisfies readonly AnnualIrpefExcerpt117[]).map((row) => Object.freeze(row)));

export function getVerifiedNationalIrpef117(taxYear: number, revisionId?: string): AnnualIrpefExcerpt117 {
  if (!VERIFIED_IRPEF_EXCERPTS_117.some((value) => value.taxYear === taxYear)) {
    throw new Error(`UNSUPPORTED_FISCAL_TAX_YEAR: ${taxYear}; only 2025/2026 national IRPEF gross tax excerpts verified`);
  }
  return selectFiscalRevision409(VERIFIED_IRPEF_EXCERPTS_117, taxYear, revisionId);
}

/** Archived 2024 agency guide, deliberately not promoted to a 2026 tax-year rule. */
export const INVOICE_STAMP_REFERENCE_2024_117 = Object.freeze({
  year: 2024,
  status: "ARCHIVED_REFERENCE_ONLY" as const,
  thresholdCentsExclusive: 7747,
  stampCents: 200,
  supportedNatures: ["N2.2", "N3.6", "N4"] as const,
  source: {
    authority: "Agenzia delle Entrate",
    url: "https://www1.agenziaentrate.gov.it/web_app_entrate/bollo_fatture_2024.html",
    artifactPath: "quality/reference-data/italy/artifacts/117-fiscal-annual/agenzia-bollo-fatture-2024.html",
    sha256: "sha256:d7f16c2012be8234ee59609578c21984295e1dfdfa50109bd54d419fcbb5ea8f",
  },
});

/**
 * Exact 9 rows of the Gazzetta Ufficiale 31-12-2018 S.O. 62/L, Law 145/2018,
 * Allegato 2, PDF page 218. This replaces Law 190/2014 Allegato 4. D.Lgs.
 * 81/2025 retains the ATECO2007 reference until new coefficients are approved.
 * `prefixes` reflect the printed codes/ranges ONLY. In particular, 47.82 and
 * 47.89 are separate printed codes, NOT an inferred 47.82–47.89 interval.
 * No mapping to the revised ATECO2025 classification is attempted.
 */
export interface AnnualForfettarioCoefficientRow117 {
  readonly sourceTableRow: number;
  readonly sectorLabel: string;
  readonly coefficientPercent: number;
  readonly prefixes: readonly string[];
}

export interface AnnualForfettarioCoefficientPack117 {
  readonly taxYear: 2025;
  readonly effectiveFrom: "2025-01-01";
  readonly effectiveTo: "2025-12-31";
  readonly atecoVersion: "ATECO2007";
  readonly status: "VERIFIED_COEFFICIENT_TABLE_ONLY";
  readonly rows: readonly AnnualForfettarioCoefficientRow117[];
  readonly sources: readonly { readonly authority: string; readonly url: string; readonly artifactPath: string; readonly sha256: `sha256:${string}`; readonly pageNumber?: number }[];
}

const rowsForfettario2025: readonly AnnualForfettarioCoefficientRow117[] = [
  { sourceTableRow: 1, sectorLabel: "Industrie alimentari e delle bevande", coefficientPercent: 40, prefixes: ["10", "11"] },
  { sourceTableRow: 2, sectorLabel: "Commercio all'ingrosso e al dettaglio", coefficientPercent: 40,
    prefixes: ["45", "46.2", "46.3", "46.4", "46.5", "46.6", "46.7", "46.8", "46.9", "47.1", "47.2", "47.3", "47.4", "47.5", "47.6", "47.7", "47.9"] },
  { sourceTableRow: 3, sectorLabel: "Commercio ambulante alimentari e bevande", coefficientPercent: 40, prefixes: ["47.81"] },
  { sourceTableRow: 4, sectorLabel: "Commercio ambulante altri prodotti", coefficientPercent: 54, prefixes: ["47.82", "47.89"] },
  { sourceTableRow: 5, sectorLabel: "Costruzioni e immobili", coefficientPercent: 86, prefixes: ["41", "42", "43", "68"] },
  { sourceTableRow: 6, sectorLabel: "Intermediari del commercio", coefficientPercent: 62, prefixes: ["46.1"] },
  { sourceTableRow: 7, sectorLabel: "Alloggio e ristorazione", coefficientPercent: 40, prefixes: ["55", "56"] },
  { sourceTableRow: 8, sectorLabel: "Attività professionali, scientifiche, finanziarie, sanitarie e istruzione", coefficientPercent: 78,
    prefixes: ["64", "65", "66", "69", "70", "71", "72", "73", "74", "75", "85", "86", "87", "88"] },
  { sourceTableRow: 9, sectorLabel: "Altre attività economiche esplicitamente elencate", coefficientPercent: 67,
    prefixes: ["01", "02", "03", "05", "06", "07", "08", "09", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "35", "36", "37", "38", "39", "49", "50", "51", "52", "53", "58", "59", "60", "61", "62", "63", "77", "78", "79", "80", "81", "82", "84", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"] },
];

export const VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117: AnnualForfettarioCoefficientPack117 = Object.freeze({
  taxYear: 2025, effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31",
  atecoVersion: "ATECO2007", status: "VERIFIED_COEFFICIENT_TABLE_ONLY",
  rows: Object.freeze(rowsForfettario2025.map((row) => Object.freeze({ ...row, prefixes: Object.freeze([...row.prefixes]) }))),
  sources: [
    { authority: "Gazzetta Ufficiale", url: "https://www.gazzettaufficiale.it/eli/gu/2018/12/31/302/so/62/sg/pdf",
      artifactPath: "quality/reference-data/italy/artifacts/117-fiscal-annual/gu-law145-2018-supplement-annex2.pdf",
      sha256: "sha256:19e507421ba6fb7f856d5c3bee3dcbf53bf3efc9a22114562951d11932bbd142", pageNumber: 218 },
    { authority: "Normattiva", url: "https://www.normattiva.it/eli/id/2025/06/12/25G00090/CONSOLIDATED/20251231",
      artifactPath: "quality/reference-data/italy/artifacts/117-fiscal-annual/normattiva-dlgs81-ateco-2025.html",
      sha256: "sha256:0ea7d51d7ee21c85445ae7be493eb2225ee38bd7b5c5d7e3fd0b2eec149c5669" },
  ] as const,
});

/** A coefficient table is not a complete annual forfettario legal/INPS pack. */
export function getVerifiedForfettarioCoefficients117(taxYear: number): AnnualForfettarioCoefficientPack117 {
  if (taxYear !== 2025) throw new Error(`UNSUPPORTED_FISCAL_TAX_YEAR: ${taxYear}; only the 2025 ATECO2007 table is source verified`);
  return VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117;
}
