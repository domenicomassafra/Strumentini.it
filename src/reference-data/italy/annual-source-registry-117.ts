/**
 * #117 annual official-source registry, maintained by agents.
 *
 * Owner decision 20/10/2026: fiscal sources are handled by agents using only
 * official sources (Agenzia delle Entrate, MEF, Gazzetta Ufficiale, with
 * Normattiva as the official law publication); each year carries date, URL,
 * version and the snapshot hash, and the annual refresh is automatic.
 *
 * This module never invents a missing value. It only composes already verified
 * excerpts into one per-year view and decides whether a published current-year
 * claim still has a checked official snapshot. A year without a snapshot stays
 * unavailable; it never inherits another year's amounts.
 */
import {
  INVOICE_STAMP_REFERENCE_2024_117,
  VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117,
  VERIFIED_IRPEF_EXCERPTS_117,
} from "./fiscal-annual-117";
import { ANNUAL_VAT_2025_WINDOW_117 } from "./fiscal-annual-vat-117";
import { ITALY_FRESHNESS_CONSUMERS_158 } from "./freshness-consumers-158";

/** Hosts allowed to appear as an official annual fiscal source. */
export const OFFICIAL_FISCAL_SOURCE_HOSTS_117 = Object.freeze([
  "normattiva.it",
  "gazzettaufficiale.it",
  "agenziaentrate.gov.it",
  "finanze.gov.it",
  "giustiziatributaria.gov.it",
] as const);

/** Exact-host or subdomain match: `evil-normattiva.it` is refused. */
export function isOfficialFiscalSourceUrl117(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return OFFICIAL_FISCAL_SOURCE_HOSTS_117.some((host) =>
    parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
}

export function assertOfficialFiscalSource117(value: string, label = "source"): URL {
  if (!isOfficialFiscalSourceUrl117(value)) {
    throw new Error(`ANNUAL_FISCAL_SOURCE_NOT_OFFICIAL_117: ${label} (${value})`);
  }
  return new URL(value);
}

export type AnnualFiscalCoverage117 =
  | "VERIFIED_IRPEF_SUBSET"
  | "VERIFIED_COEFFICIENT_TABLE"
  | "VERIFIED_LIMITED_WINDOW"
  | "ARCHIVED_REFERENCE";

export interface AnnualFiscalSourceRow117 {
  readonly taxYear: number;
  readonly datasetId: string;
  readonly label: string;
  /** Identifiable version of the verified snapshot consumed by calculators. */
  readonly version: string;
  readonly authority: string;
  readonly url: string;
  readonly sha256: string;
  readonly checkedAt: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly coverage: AnnualFiscalCoverage117;
  readonly limitation: string;
  /** True only for datasets that advertise a current-year calculation. */
  readonly claimsCurrentYear: boolean;
}

/** Datasets whose annual snapshot this registry owns; other current-year
 * datasets (INPS, calendar) remain audited by the #158 freshness index. */
export const ANNUAL_FISCAL_DATASETS_117 = Object.freeze([
  "national-irpef-gross-subset",
  "forfettario-ateco2007-coefficients",
  "vat-2025-limited-window",
  "invoice-stamp-reference-2024",
] as const);

const currentYearDatasets = new Set(ITALY_FRESHNESS_CONSUMERS_158
  .filter((consumer) => consumer.claim === "current-year"
    && (ANNUAL_FISCAL_DATASETS_117 as readonly string[]).includes(consumer.datasetId))
  .map((consumer) => consumer.datasetId));

const row = (input: Omit<AnnualFiscalSourceRow117, "claimsCurrentYear">): AnnualFiscalSourceRow117 => {
  assertOfficialFiscalSource117(input.url, input.datasetId);
  return Object.freeze({ ...input, claimsCurrentYear: currentYearDatasets.has(input.datasetId) });
};

function buildRows(): readonly AnnualFiscalSourceRow117[] {
  const rows: AnnualFiscalSourceRow117[] = [];
  for (const excerpt of VERIFIED_IRPEF_EXCERPTS_117) {
    for (const source of excerpt.sources) {
      rows.push(row({
        taxYear: excerpt.taxYear, datasetId: "national-irpef-gross-subset",
        label: "IRPEF nazionale lorda (scaglioni)", version: excerpt.revisionId,
        authority: source.authority, url: source.url, sha256: source.sha256,
        checkedAt: excerpt.checkedAt, effectiveFrom: excerpt.effectiveFrom, effectiveTo: excerpt.effectiveTo,
        coverage: "VERIFIED_IRPEF_SUBSET",
        limitation: "Solo scaglioni nazionali lordi; detrazioni e addizionali richiedono fonti separate.",
      }));
    }
  }
  const coefficients = VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117;
  for (const source of coefficients.sources) {
    rows.push(row({
      taxYear: coefficients.taxYear, datasetId: "forfettario-ateco2007-coefficients",
      label: `Coefficienti forfettario ${coefficients.atecoVersion}`,
      version: `${coefficients.atecoVersion}-${coefficients.taxYear}-v1`,
      authority: source.authority, url: source.url, sha256: source.sha256,
      checkedAt: "2026-10-06", effectiveFrom: coefficients.effectiveFrom, effectiveTo: coefficients.effectiveTo,
      coverage: "VERIFIED_COEFFICIENT_TABLE",
      limitation: "Solo tabella coefficienti stampata; ammissibilità, contributi e ATECO 2025 non sono dedotti.",
    }));
  }
  const vat = ANNUAL_VAT_2025_WINDOW_117;
  for (const source of vat.sources) {
    rows.push(row({
      taxYear: vat.taxYear, datasetId: "vat-2025-limited-window",
      label: "IVA D.P.R. 633/1972 art. 16 e Tabella A",
      version: `DPR633-${vat.taxYear}-${vat.validFrom}-v1`,
      authority: source.authority, url: source.url, sha256: source.sha256,
      checkedAt: "2026-10-06", effectiveFrom: vat.validFrom, effectiveTo: vat.validTo,
      coverage: "VERIFIED_LIMITED_WINDOW",
      limitation: "Solo 13–31 dicembre 2025, con ambito legale dichiarato dall'utente.",
    }));
  }
  const stamp = INVOICE_STAMP_REFERENCE_2024_117;
  rows.push(row({
    taxYear: stamp.year, datasetId: "invoice-stamp-reference-2024",
    label: "Bollo fatture — guida archiviata",
    version: `AdE-bollo-fatture-${stamp.year}`, authority: stamp.source.authority,
    url: stamp.source.url, sha256: stamp.source.sha256, checkedAt: "2026-10-09",
    effectiveFrom: `${stamp.year}-01-01`, effectiveTo: `${stamp.year}-12-31`,
    coverage: "ARCHIVED_REFERENCE",
    limitation: "Riferimento archiviato dell'anno indicato; nessuna certificazione per anni successivi.",
  }));
  return Object.freeze(rows.map((entry) => Object.freeze(entry)));
}

export const ANNUAL_FISCAL_SOURCE_ROWS_117: readonly AnnualFiscalSourceRow117[] = buildRows();

export function listAnnualFiscalSourceYears117(): readonly number[] {
  return Object.freeze([...new Set(ANNUAL_FISCAL_SOURCE_ROWS_117.map((entry) => entry.taxYear))].sort((a, b) => a - b));
}

/** Unknown years return an empty list: nothing is carried over from another year. */
export function getAnnualFiscalSourceRows117(taxYear: number): readonly AnnualFiscalSourceRow117[] {
  return Object.freeze(ANNUAL_FISCAL_SOURCE_ROWS_117.filter((entry) => entry.taxYear === taxYear));
}

export interface AnnualFiscalSourceReview117 {
  readonly asOf: string;
  readonly currentYear: number;
  /** Rome civil year rollover: the review opens on 1 January. */
  readonly nextAnnualReviewAt: string;
  readonly rows: readonly AnnualFiscalSourceRow117[];
  readonly currentYearDatasets: readonly string[];
  readonly currentYearCovered: readonly string[];
  readonly blockedClaims: readonly string[];
  readonly warnings: readonly string[];
  readonly ok: boolean;
}

const assertDate117 = (asOf: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(asOf)) throw new Error("ANNUAL_FISCAL_REVIEW_INVALID_DATE_117");
  const [year, month, day] = asOf.split("-").map(Number);
  if (new Date(Date.UTC(year!, month! - 1, day!)).toISOString().slice(0, 10) !== asOf) {
    throw new Error("ANNUAL_FISCAL_REVIEW_INVALID_DATE_117");
  }
  return year!;
};

/**
 * Automatic annual review. A dataset that advertises a current-year calculation
 * fails as soon as the current year has no checked official snapshot; datasets
 * deliberately pinned to a past year only warn, so missing coverage is visible
 * without inventing values.
 */
export function buildAnnualFiscalSourceReview117(asOf: string): AnnualFiscalSourceReview117 {
  const currentYear = assertDate117(asOf);
  const claims = [...currentYearDatasets].sort();
  const covered = claims.filter((datasetId) => ANNUAL_FISCAL_SOURCE_ROWS_117.some((entry) =>
    entry.datasetId === datasetId && entry.taxYear === currentYear && entry.checkedAt <= asOf));
  const blockedClaims = claims.filter((datasetId) => !covered.includes(datasetId))
    .map((datasetId) => `${datasetId}:${currentYear}`);
  const warnings = ANNUAL_FISCAL_SOURCE_ROWS_117
    .filter((entry) => entry.taxYear < currentYear && entry.datasetId !== "national-irpef-gross-subset")
    .map((entry) => `${entry.datasetId}:${entry.taxYear}:HISTORICAL_ONLY`);
  return Object.freeze({
    asOf, currentYear, nextAnnualReviewAt: `${currentYear + 1}-01-01`,
    rows: ANNUAL_FISCAL_SOURCE_ROWS_117,
    currentYearDatasets: Object.freeze(claims),
    currentYearCovered: Object.freeze(covered),
    blockedClaims: Object.freeze(blockedClaims),
    warnings: Object.freeze([...new Set(warnings)]),
    ok: blockedClaims.length === 0,
  });
}

/** Fail-closed boundary used by the scheduled review and by release checks. */
export function assertAnnualFiscalSourceReview117(asOf: string): AnnualFiscalSourceReview117 {
  const review = buildAnnualFiscalSourceReview117(asOf);
  if (!review.ok) {
    throw new Error(`ANNUAL_FISCAL_SOURCE_STALE_117: annual review due for ${review.currentYear} ` +
      `(${review.blockedClaims.join(", ")}); add a verified official snapshot, never reuse another year`);
  }
  return review;
}
