/**
 * Source-only review index: a pinned year is not automatically the current year.
 * No network request or implicit upgrade of a historical fiscal rule is made.
 */
import {
  FATTURAPA_TECHNICAL_CURRENT,
  INPS_CONTRIBUTIONS_2026,
  ITALY_NATIONAL_HOLIDAYS_2026,
} from "./annual-2026";
import {
  VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117,
  VERIFIED_IRPEF_EXCERPTS_117,
} from "./fiscal-annual-117";
import { ANNUAL_VAT_2025_WINDOW_117 } from "./fiscal-annual-vat-117";
import { listItalySourcePackDecisions } from "./source-packs";
import { ITALY_FRESHNESS_CONSUMERS_158 } from "./freshness-consumers-158";

export type ItalyFreshnessStatus158 =
  | "CURRENT_BOUNDED"
  | "HISTORICAL_ONLY"
  | "FUTURE_PINNED_YEAR"
  | "NOT_YET_CHECKED"
  | "REVIEW_EXPIRED"
  | "SOURCE_CHANGE_MONITOR"
  | "READY_SOURCE_ONLY"
  | "BLOCKED_SOURCE";

export interface ItalyFreshnessEntry158 {
  readonly recordId: string;
  readonly datasetId: string;
  readonly owner: string;
  readonly version: string;
  readonly latestSupportedYear: number | null;
  readonly checkedAt: string;
  readonly nextReviewCondition: string;
  /** Exclusive deadline: a current-year claim is refused on this date. */
  readonly nextReviewAt: string | null;
  readonly sourceUrl: string | null;
  readonly status: ItalyFreshnessStatus158;
  readonly limitation: string;
}

const yearReview = "Review the next tax/calendar year against a new pinned official version before claiming current-year support.";
const annualReviewDeadline = (year: number): string => `${year}-12-31`;
/** Annual Italian rules switch on Rome civil midnight, including in UTC-hosted browsers. */
export const todayItaly158 = (instant = new Date()): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);

/** Additional dated rules already consumed by the public Italy tools. No year is inferred. */
const additionalAnnual = [
  {
    datasetId: "inps-agricultural-fpld-2025", owner: "STR-013 (INPS 46/2025)",
    version: "INPS-circ-46/2025", latestSupportedYear: 2025,
    checkedAt: "2026-10-18",
    sourceUrl: "https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2025/02/Circolare_14840/Allegati/15918_Circolare-numero-46-del-20-02-2025.pdf",
    limitation: "Only ordinary agricultural FPLD 2025 with user-confirmed contribution base; not a current payroll rate.",
  },
  {
    datasetId: "irpef-components-bari-puglia-2025", owner: "STR-128 (MEF)",
    version: "2025-employee-deduction-puglia-bari", latestSupportedYear: 2025,
    checkedAt: "2026-10-18",
    sourceUrl: "https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?anno=2025&reg=14",
    limitation: "Only 2025 employment deduction, Puglia regional and Bari municipal surtaxes, under declared conditions.",
  },
  {
    datasetId: "forfettario-inps-gs-2025", owner: "STR-133 (INPS 27/2025)",
    version: "INPS-circ-27/2025", latestSupportedYear: 2025,
    checkedAt: "2026-10-18",
    sourceUrl: "https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2025/01/Circolare_14807/Allegati/15871_Circolare-numero-27-del-30-01-2025.pdf",
    limitation: "Only Gestione Separata ordinary professional rates for the 2025 forfettario illustration.",
  },
  {
    datasetId: "tfr-foi-december-2025", owner: "STR-134 (ISTAT)",
    version: "FOI-2025-12", latestSupportedYear: 2025,
    checkedAt: "2026-10-18",
    sourceUrl: "https://www.istat.it/comunicato-stampa/prezzi-al-consumo-dicembre-2025/",
    limitation: "December 2025 TFR revaluation only; no monthly 2026 FOI coefficient is inferred.",
  },
  {
    datasetId: "invoice-stamp-reference-2024", owner: "STR-152 (Agenzia delle Entrate)",
    version: "Agenzia-2024-Elenco-B", latestSupportedYear: 2024,
    checkedAt: "2026-10-09",
    sourceUrl: "https://www1.agenziaentrate.gov.it/web_app_entrate/bollo_fatture_2024.html",
    limitation: "Archived 2024 invoice-stamp reference only, no current-year legal certification.",
  },
] as const;

const asYear = (asOf: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(asOf)) throw new Error("FRESHNESS158_INVALID_DATE");
  const [year, month, day] = asOf.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  if (parsed.toISOString().slice(0, 10) !== asOf) throw new Error("FRESHNESS158_INVALID_DATE");
  return year!;
};

/** Includes both independent bounded source excerpts and the readiness decisions.
 * A full #117 source pack remains BLOCKED even if a narrow IRPEF excerpt is current.
 */
export function buildItalyFreshnessReport158(asOf: string) {
  const year = asYear(asOf);
  const decisions = listItalySourcePackDecisions();
  const fiscal = decisions.find((entry) => entry.ticket === 117)!;
  const latestIrpef = [...VERIFIED_IRPEF_EXCERPTS_117].sort((a, b) => b.taxYear - a.taxYear)[0]!;

  const annual = [
    {
      datasetId: "italy-national-holidays", owner: "STR-116 source pack",
      version: ITALY_NATIONAL_HOLIDAYS_2026.metadata.version,
      latestSupportedYear: ITALY_NATIONAL_HOLIDAYS_2026.metadata.year!,
      checkedAt: ITALY_NATIONAL_HOLIDAYS_2026.metadata.checkedAt,
      sourceUrl: ITALY_NATIONAL_HOLIDAYS_2026.metadata.sources[0]!.url,
      limitation: "National 2026 holidays only; local patronal rules are not inferred.",
    },
    {
      datasetId: "inps-contributions-annual", owner: "STR-118 source pack",
      version: INPS_CONTRIBUTIONS_2026.metadata.version,
      latestSupportedYear: INPS_CONTRIBUTIONS_2026.metadata.year!,
      checkedAt: INPS_CONTRIBUTIONS_2026.metadata.checkedAt,
      sourceUrl: INPS_CONTRIBUTIONS_2026.metadata.sources[0]!.url,
      limitation: "Only the expressly supported INPS 2026 profiles; not a universal payroll engine.",
    },
    {
      datasetId: "national-irpef-gross-subset", owner: "STR-117 source pack",
      version: `tax-${latestIrpef.taxYear}-verified-subset`,
      latestSupportedYear: latestIrpef.taxYear,
      checkedAt: fiscal.checkedAt,
      sourceUrl: latestIrpef.sources[0]!.url,
      limitation: "National gross IRPEF bands only; full #117 fiscal pack remains BLOCKED.",
    },
    {
      datasetId: "forfettario-ateco2007-coefficients", owner: "STR-117 source pack",
      version: VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117.atecoVersion,
      latestSupportedYear: VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117.taxYear,
      checkedAt: fiscal.checkedAt,
      sourceUrl: VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117.sources[0]!.url,
      limitation: "2025 printed coefficients only; no 2026 rate, eligibility or ATECO2025 inference.",
    },
    {
      datasetId: "vat-2025-limited-window", owner: "STR-117 source pack",
      version: ANNUAL_VAT_2025_WINDOW_117.status,
      latestSupportedYear: ANNUAL_VAT_2025_WINDOW_117.taxYear,
      checkedAt: fiscal.checkedAt,
      sourceUrl: ANNUAL_VAT_2025_WINDOW_117.sources[0]!.url,
      limitation: "Only 13–31 December 2025, with exact user-declared legal scope.",
    },
    ...additionalAnnual,
  ] as const;

  const entries: ItalyFreshnessEntry158[] = annual.map((item) => ({
    ...item,
    recordId: `annual:${item.datasetId}`,
    nextReviewCondition: yearReview,
    nextReviewAt: annualReviewDeadline(item.latestSupportedYear),
    status: item.checkedAt > asOf ? "NOT_YET_CHECKED"
      : item.latestSupportedYear === year
        ? asOf >= annualReviewDeadline(item.latestSupportedYear) ? "REVIEW_EXPIRED" : "CURRENT_BOUNDED"
        : item.latestSupportedYear < year ? "HISTORICAL_ONLY" : "FUTURE_PINNED_YEAR",
  }));
  entries.push({
    recordId: `schema:${FATTURAPA_TECHNICAL_CURRENT.metadata.datasetId}`,
    datasetId: FATTURAPA_TECHNICAL_CURRENT.metadata.datasetId,
    owner: "STR-119 source pack",
    version: FATTURAPA_TECHNICAL_CURRENT.metadata.version,
    latestSupportedYear: null,
    checkedAt: FATTURAPA_TECHNICAL_CURRENT.metadata.checkedAt,
    nextReviewCondition: decisions.find((entry) => entry.ticket === 119)!.freshness.reviewTrigger,
    nextReviewAt: null,
    sourceUrl: FATTURAPA_TECHNICAL_CURRENT.metadata.sources[0]!.url,
    status: FATTURAPA_TECHNICAL_CURRENT.metadata.checkedAt > asOf ? "NOT_YET_CHECKED" : "SOURCE_CHANGE_MONITOR",
    limitation: "Pinned schema only; published upstream changes are not checked over the network.",
  });
  for (const decision of decisions) {
    entries.push({
      recordId: `decision:STR-${decision.ticket}:${decision.datasetId}`,
      datasetId: decision.datasetId,
      owner: `STR-${decision.ticket} source decision`,
      version: decision.decisionVersion,
      latestSupportedYear: null,
      checkedAt: decision.checkedAt,
      nextReviewCondition: decision.freshness.reviewTrigger,
      nextReviewAt: null,
      sourceUrl: decision.officialSources[0]?.url ?? decision.candidateOfficialSources?.[0]?.url ?? null,
      status: decision.checkedAt > asOf ? "NOT_YET_CHECKED"
        : decision.status === "READY" ? "READY_SOURCE_ONLY" : "BLOCKED_SOURCE",
      limitation: decision.reason,
    });
  }
  return {
    asOf,
    entries,
    consumers: ITALY_FRESHNESS_CONSUMERS_158.map((consumer) => ({
      ...consumer,
      source: entries.find((entry) => entry.datasetId === consumer.datasetId)!,
    })),
    warnings: entries.filter((entry) => !["CURRENT_BOUNDED", "READY_SOURCE_ONLY", "SOURCE_CHANGE_MONITOR"].includes(entry.status))
      .map((entry) => `${entry.recordId}: ${entry.status}; ${entry.limitation}`),
  };
}

/**
 * Engine boundary for pinned annual datasets. Explicit historical tax years
 * remain usable offline. Only a claim for today's calendar year needs an
 * unexpired, already checked source snapshot.
 */
export function assertItalyPinnedAnnualUse158(datasetId: string, pinnedYear: number, asOf = todayItaly158()): void {
  const calendarYear = asYear(asOf);
  if (pinnedYear > calendarYear) throw new Error(`FRESHNESS158_FUTURE_CLAIM: ${datasetId} ${pinnedYear}`);
  if (pinnedYear === calendarYear) {
    assertItalyCurrentYearClaim158(buildItalyFreshnessReport158(asOf), datasetId, pinnedYear);
  }
}

/** Stop newly advertised current-year claims when the source index lacks that year.
 * Historical examples can still run with their explicitly pinned year.
 */
export function assertItalyCurrentYearClaim158(
  report: ReturnType<typeof buildItalyFreshnessReport158>,
  datasetId: string,
  claimedYear: number,
): void {
  const referenceYear = asYear(report.asOf);
  const row = report.entries.find((entry) => entry.datasetId === datasetId && entry.latestSupportedYear !== null);
  if (!row || claimedYear !== referenceYear || row.latestSupportedYear !== claimedYear
    || row.status !== "CURRENT_BOUNDED") {
    throw new Error(`FRESHNESS158_UNSUPPORTED_CURRENT_CLAIM: ${datasetId} ${claimedYear} as of ${report.asOf}`);
  }
}
