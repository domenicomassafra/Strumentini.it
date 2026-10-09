/**
 * Narrow official-source excerpts for independent fiscal consumers.
 * This is NOT the complete #117 annual pack: IVA and forfettario remain blocked.
 * The 2026 brackets compose the 2025 TUIR replacement with the 2026 amendment.
 */
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
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly status: "VERIFIED_IRPEF_SUBSET_ONLY";
  readonly bands: readonly AnnualIrpefBand117[];
  readonly sources: readonly FiscalSource117[];
}

const law2025: FiscalSource117 = {
  authority: "Normattiva",
  url: "https://www.normattiva.it/eli/stato/LEGGE/2024/12/30/207/ORIGINAL",
  artifactPath: "quality/reference-data/italy/artifacts/117-fiscal-annual/normattiva-legge-207-2024-original.html",
  sha256: "sha256:6c0ea88f5ea8abd7f2c709d94804095dd0a175ed9f4921a5a9b0e2e35a2517b5",
};
const amendment2026: FiscalSource117 = {
  authority: "Normattiva",
  url: "https://www.normattiva.it/eli/stato/LEGGE/2025/12/30/199/CONSOLIDATED",
  artifactPath: "quality/reference-data/italy/artifacts/117-fiscal-annual/normattiva-legge-199-2025-consolidated.html",
  sha256: "sha256:5ac25beddb71144367f68f3262f8da33fae195c7ce969421d04c5f69c8078f85",
};

export const VERIFIED_IRPEF_EXCERPTS_117: readonly AnnualIrpefExcerpt117[] = Object.freeze([
  {
    taxYear: 2025, effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31", status: "VERIFIED_IRPEF_SUBSET_ONLY",
    bands: [{ upToCents: 2_800_000, rateBasisPoints: 2300 }, { upToCents: 5_000_000, rateBasisPoints: 3500 },
      { upToCents: null, rateBasisPoints: 4300 }],
    sources: [law2025],
  },
  {
    taxYear: 2026, effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", status: "VERIFIED_IRPEF_SUBSET_ONLY",
    bands: [{ upToCents: 2_800_000, rateBasisPoints: 2300 }, { upToCents: 5_000_000, rateBasisPoints: 3300 },
      { upToCents: null, rateBasisPoints: 4300 }],
    sources: [law2025, amendment2026],
  },
]);

export function getVerifiedNationalIrpef117(taxYear: number): AnnualIrpefExcerpt117 {
  const pack = VERIFIED_IRPEF_EXCERPTS_117.find((value) => value.taxYear === taxYear);
  if (!pack) throw new Error(`UNSUPPORTED_FISCAL_TAX_YEAR: ${taxYear}; only 2025/2026 national IRPEF gross tax excerpts verified`);
  return pack;
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
