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

export type ItalyFreshnessStatus158 =
  | "CURRENT_BOUNDED"
  | "HISTORICAL_ONLY"
  | "FUTURE_PINNED_YEAR"
  | "NOT_YET_CHECKED"
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
  readonly status: ItalyFreshnessStatus158;
  readonly limitation: string;
}

const yearReview = "Review the next tax/calendar year against a new pinned official version before claiming current-year support.";

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
      limitation: "National 2026 holidays only; local patronal rules are not inferred.",
    },
    {
      datasetId: "inps-contributions-annual", owner: "STR-118 source pack",
      version: INPS_CONTRIBUTIONS_2026.metadata.version,
      latestSupportedYear: INPS_CONTRIBUTIONS_2026.metadata.year!,
      checkedAt: INPS_CONTRIBUTIONS_2026.metadata.checkedAt,
      limitation: "Only the expressly supported INPS 2026 profiles; not a universal payroll engine.",
    },
    {
      datasetId: "national-irpef-gross-subset", owner: "STR-117 source pack",
      version: `tax-${latestIrpef.taxYear}-verified-subset`,
      latestSupportedYear: latestIrpef.taxYear,
      checkedAt: fiscal.checkedAt,
      limitation: "National gross IRPEF bands only; full #117 fiscal pack remains BLOCKED.",
    },
    {
      datasetId: "forfettario-ateco2007-coefficients", owner: "STR-117 source pack",
      version: VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117.atecoVersion,
      latestSupportedYear: VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117.taxYear,
      checkedAt: fiscal.checkedAt,
      limitation: "2025 printed coefficients only; no 2026 rate, eligibility or ATECO2025 inference.",
    },
    {
      datasetId: "vat-2025-limited-window", owner: "STR-117 source pack",
      version: ANNUAL_VAT_2025_WINDOW_117.status,
      latestSupportedYear: ANNUAL_VAT_2025_WINDOW_117.taxYear,
      checkedAt: fiscal.checkedAt,
      limitation: "Only 13–31 December 2025, with exact user-declared legal scope.",
    },
  ] as const;

  const entries: ItalyFreshnessEntry158[] = annual.map((item) => ({
    ...item,
    recordId: `annual:${item.datasetId}`,
    nextReviewCondition: yearReview,
    status: item.checkedAt > asOf ? "NOT_YET_CHECKED"
      : item.latestSupportedYear === year ? "CURRENT_BOUNDED"
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
      status: decision.checkedAt > asOf ? "NOT_YET_CHECKED"
        : decision.status === "READY" ? "READY_SOURCE_ONLY" : "BLOCKED_SOURCE",
      limitation: decision.reason,
    });
  }
  return {
    asOf,
    entries,
    warnings: entries.filter((entry) => !["CURRENT_BOUNDED", "READY_SOURCE_ONLY", "SOURCE_CHANGE_MONITOR"].includes(entry.status))
      .map((entry) => `${entry.recordId}: ${entry.status}; ${entry.limitation}`),
  };
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
