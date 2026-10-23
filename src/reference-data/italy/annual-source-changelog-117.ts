/**
 * #409 append-only change log for the annual official fiscal sources.
 *
 * Owner decision 20/10/2026: the agents own the annual official-source review
 * and may use only Agenzia delle Entrate, MEF, Gazzetta Ufficiale and
 * Normattiva documents. This module records one immutable entry per published
 * annual revision, so an effective or retroactive amendment stays auditable
 * instead of silently rewriting a past result. A retroactive amendment still
 * needs a named accountable reviewer and a new official hash; a missing year is
 * reported as NOT_RUN and never inherits another year's values.
 */
import {
  ANNUAL_FISCAL_REVIEW_OWNER_117,
  ANNUAL_FISCAL_SOURCE_ROWS_117,
  assertOfficialFiscalSource117,
} from "./annual-source-registry-117";
import type { AnnualFiscalSourceRow117 } from "./annual-source-registry-117";
import { VERIFIED_IRPEF_EXCERPTS_117 } from "./fiscal-annual-117";

export type AnnualSourceAmendmentKind117 = "YEAR_BASELINE" | "RETROACTIVE_AMENDMENT";

export interface AnnualSourceChangeEntry117 {
  readonly entryId: string;
  readonly datasetId: string;
  readonly taxYear: number;
  readonly version: string;
  readonly checkedAt: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly amendmentKind: AnnualSourceAmendmentKind117;
  readonly supersedesRevisionId: string | null;
  readonly sourceOwnerId: string;
  /** Explicitly null until a qualified fiscal reviewer signs this change. */
  readonly reviewOwner: string | null;
  readonly sourceUrls: readonly string[];
  readonly sourceHashes: readonly string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256 = /^sha256:[a-f0-9]{64}$/u;

function isIsoDate117(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function entryIdOf117(row: Pick<AnnualFiscalSourceRow117, "datasetId" | "taxYear" | "version">): string {
  return `${row.datasetId}:${row.taxYear}:${row.version}`;
}

function buildEntries117(): readonly AnnualSourceChangeEntry117[] {
  const groups = new Map<string, AnnualFiscalSourceRow117[]>();
  for (const sourceRow of ANNUAL_FISCAL_SOURCE_ROWS_117) {
    const key = entryIdOf117(sourceRow);
    groups.set(key, [...(groups.get(key) ?? []), sourceRow]);
  }
  const entries = [...groups.values()].map((rows) => {
    const first = rows[0];
    if (!first) throw new Error("ANNUAL_CHANGELOG_EMPTY_GROUP_117");
    const revision = first.datasetId === "national-irpef-gross-subset"
      ? VERIFIED_IRPEF_EXCERPTS_117.find((excerpt) => excerpt.revisionId === first.version)
      : undefined;
    if (first.datasetId === "national-irpef-gross-subset" && !revision) {
      throw new Error(`ANNUAL_CHANGELOG_UNKNOWN_REVISION_117: ${first.version}`);
    }
    return Object.freeze({
      entryId: entryIdOf117(first), datasetId: first.datasetId, taxYear: first.taxYear, version: first.version,
      checkedAt: first.checkedAt, effectiveFrom: first.effectiveFrom, effectiveTo: first.effectiveTo,
      amendmentKind: revision?.amendmentKind ?? "YEAR_BASELINE",
      supersedesRevisionId: revision?.supersedesRevisionId ?? null,
      sourceOwnerId: ANNUAL_FISCAL_REVIEW_OWNER_117.ownerId,
      reviewOwner: revision?.reviewOwner ?? null,
      sourceUrls: Object.freeze([...new Set(rows.map((row) => row.url))].sort()),
      sourceHashes: Object.freeze([...new Set(rows.map((row) => row.sha256))].sort()),
    } satisfies AnnualSourceChangeEntry117);
  });
  return assertAnnualSourceChangeLog117(entries
    .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt) || left.entryId.localeCompare(right.entryId)));
}

/** Validates the whole append-only chain before anything is rendered or reused. */
export function assertAnnualSourceChangeLog117(
  entries: readonly AnnualSourceChangeEntry117[],
): readonly AnnualSourceChangeEntry117[] {
  if (entries.length === 0 || entries.length > 256) throw new Error("ANNUAL_CHANGELOG_LIMIT_117");
  const seenAt = new Map<string, number>();
  entries.forEach((entry, index) => {
    if (entry.entryId !== entryIdOf117(entry)) throw new Error("ANNUAL_CHANGELOG_INVALID_ID_117");
    if (seenAt.has(entry.entryId)) throw new Error(`ANNUAL_CHANGELOG_DUPLICATE_117: ${entry.entryId}`);
    if (!Number.isSafeInteger(entry.taxYear) || entry.taxYear < 1900 || entry.taxYear > 2200
      || ![entry.checkedAt, entry.effectiveFrom, entry.effectiveTo].every(isIsoDate117)
      || entry.effectiveFrom > entry.effectiveTo
      || entry.effectiveFrom.slice(0, 4) !== String(entry.taxYear)
      || entry.effectiveTo.slice(0, 4) !== String(entry.taxYear)) {
      throw new Error(`ANNUAL_CHANGELOG_INVALID_DATE_117: ${entry.entryId}`);
    }
    if (entry.sourceUrls.length === 0 || entry.sourceHashes.length === 0) {
      throw new Error(`ANNUAL_CHANGELOG_INVALID_SOURCE_117: ${entry.entryId}`);
    }
    for (const url of entry.sourceUrls) assertOfficialFiscalSource117(url, entry.entryId);
    if (entry.sourceHashes.some((hash) => !SHA256.test(hash))) {
      throw new Error(`ANNUAL_CHANGELOG_INVALID_SOURCE_117: ${entry.entryId}`);
    }
    if (entry.sourceOwnerId !== ANNUAL_FISCAL_REVIEW_OWNER_117.ownerId) {
      throw new Error(`ANNUAL_CHANGELOG_UNKNOWN_OWNER_117: ${entry.entryId}`);
    }
    if (entry.amendmentKind === "RETROACTIVE_AMENDMENT") {
      const previousIndex = entry.supersedesRevisionId
        ? seenAt.get(`${entry.datasetId}:${entry.taxYear}:${entry.supersedesRevisionId}`)
        : undefined;
      const previous = previousIndex === undefined ? undefined : entries[previousIndex];
      if (!previous || previous.taxYear !== entry.taxYear || entry.checkedAt <= previous.checkedAt
        || entry.effectiveFrom < previous.effectiveFrom || entry.effectiveTo > previous.effectiveTo
        || !entry.reviewOwner?.trim()
        || entry.sourceHashes.every((hash) => previous.sourceHashes.includes(hash))) {
        throw new Error(`ANNUAL_CHANGELOG_INVALID_AMENDMENT_117: ${entry.entryId}`);
      }
    } else {
      const baselineExists = entries.slice(0, index)
        .some((old) => old.datasetId === entry.datasetId && old.taxYear === entry.taxYear);
      if (entry.supersedesRevisionId !== null || baselineExists) {
        throw new Error(`ANNUAL_CHANGELOG_INVALID_BASELINE_117: ${entry.entryId}`);
      }
    }
    seenAt.set(entry.entryId, index);
  });
  for (let index = 1; index < entries.length; index++) {
    if (entries[index - 1]!.checkedAt > entries[index]!.checkedAt) {
      throw new Error(`ANNUAL_CHANGELOG_NOT_APPEND_ONLY_117: ${entries[index]!.entryId}`);
    }
  }
  return Object.freeze(entries.map((entry) => Object.freeze({
    ...entry,
    sourceUrls: Object.freeze([...entry.sourceUrls]),
    sourceHashes: Object.freeze([...entry.sourceHashes]),
  })));
}

export const ANNUAL_SOURCE_CHANGE_LOG_117: readonly AnnualSourceChangeEntry117[] = buildEntries117();

export function getAnnualSourceChangeEntries117(taxYear: number): readonly AnnualSourceChangeEntry117[] {
  return Object.freeze(ANNUAL_SOURCE_CHANGE_LOG_117.filter((entry) => entry.taxYear === taxYear));
}

export interface AnnualSourceYearAudit117 {
  readonly taxYear: number;
  readonly outcome: "CHECKED" | "NOT_RUN";
  readonly sourceCheckedAt: string | null;
  readonly revisions: readonly string[];
}

export interface AnnualSourceChangeAudit117 {
  readonly asOf: string;
  readonly currentYear: number;
  readonly yearOutcomes: readonly AnnualSourceYearAudit117[];
  readonly checkedYears: readonly number[];
  readonly notRunYears: readonly number[];
  readonly retroactiveAmendments: readonly string[];
  readonly ok: boolean;
  readonly note: string;
}

/**
 * Audit of the change log at a reference date. A year with no entry checked on
 * or before `asOf` is NOT_RUN; an uncovered current year makes the audit NO_GO.
 */
export function auditAnnualSourceChangeLog117(
  asOf: string,
  entries: readonly AnnualSourceChangeEntry117[] = ANNUAL_SOURCE_CHANGE_LOG_117,
): AnnualSourceChangeAudit117 {
  if (!isIsoDate117(asOf)) throw new Error("ANNUAL_CHANGELOG_INVALID_DATE_117");
  const currentYear = Number(asOf.slice(0, 4));
  const years = [...new Set([
    ...entries.filter((entry) => entry.taxYear <= currentYear).map((entry) => entry.taxYear),
    currentYear,
  ])]
    .sort((left, right) => left - right);
  const yearOutcomes = years.map((taxYear): AnnualSourceYearAudit117 => {
    const checked = entries
      .filter((entry) => entry.taxYear === taxYear && entry.checkedAt <= asOf);
    return Object.freeze({
      taxYear,
      outcome: checked.length === 0 ? "NOT_RUN" : "CHECKED",
      sourceCheckedAt: checked.at(-1)?.checkedAt ?? null,
      revisions: Object.freeze(checked.map((entry) => entry.version)),
    });
  });
  const checkedYears = yearOutcomes.filter((row) => row.outcome === "CHECKED").map((row) => row.taxYear);
  const notRunYears = yearOutcomes.filter((row) => row.outcome === "NOT_RUN").map((row) => row.taxYear);
  const retroactiveAmendments = entries
    .filter((entry) => entry.amendmentKind === "RETROACTIVE_AMENDMENT" && entry.checkedAt <= asOf)
    .map((entry) => entry.entryId);
  return Object.freeze({
    asOf, currentYear, yearOutcomes: Object.freeze(yearOutcomes),
    checkedYears: Object.freeze(checkedYears), notRunYears: Object.freeze(notRunYears),
    retroactiveAmendments: Object.freeze(retroactiveAmendments),
    ok: notRunYears.length === 0,
    note: notRunYears.length === 0
      ? "Ogni anno registrato ha uno snapshot ufficiale verificato alla data di audit."
      : `Nessuna evidenza ufficiale per ${notRunYears.join(", ")}: NOT_RUN, nessun valore ereditato.`,
  });
}
