import frozen from "./geography-115-date-exact-20261010.snapshot.json";

/**
 * #115 official day-exact historical municipality supplement. SITUAS snapshots
 * attest the code ON THAT ONE DATE, never all dates between report samples.
 * No online runtime lookup, no substitutions of successor entities, no claim
 * of official Codice Fiscale assignment. #121/#122 consumers may only use
 * these exact dated candidates, and still need a separate integration gate.
 */
export const ITALY_SITUAS_EXACT_DATES_115 = Object.freeze({
  version: frozen.version,
  checkedAt: frozen.checkedAt,
  authority: "ISTAT / SITUAS",
  dates: Object.freeze(frozen.days.map((x) => x.date)),
  sources: Object.freeze(frozen.sourceRefs.map((entry) => ({ ...entry }))),
  metadataSources: Object.freeze(frozen.metadataRefs.map((entry) => ({ ...entry }))),
});

export interface MunicipalityExactCandidate115 {
  readonly istatCode: string;
  readonly name: string;
  readonly belfiore: string | null;
  readonly sourceRow: number;
}

export type ExactDateStatus115 = "ATTESTED_AT_EXACT_DATE" | "OFFICIAL_CODE_UNAVAILABLE"
  | "INVALID_IDENTIFIER" | "INVALID_DATE" | "DATE_NOT_PINNED" | "NOT_ACTIVE_AT_DATE";

export interface ExactDateResult115 {
  readonly status: ExactDateStatus115;
  readonly verifiedDate: string;
  readonly sourceReport: number | null;
  readonly sourceVersion: string;
  readonly dayValidity: "OFFICIAL_SINGLE_DAY_ONLY";
  readonly officialAssignment: false;
  readonly municipality: MunicipalityExactCandidate115 | null;
}

const dayIndex = new Map<string, { report: number; byIstat: Map<string, MunicipalityExactCandidate115>; byCode: Map<string, MunicipalityExactCandidate115[]> }>();
for (const snap of frozen.days) {
  const byIstat = new Map<string, MunicipalityExactCandidate115>();
  const byCode = new Map<string, MunicipalityExactCandidate115[]>();
  for (const row of snap.rows) {
    const istatCode = String(row[0]);
    const name = String(row[1]);
    const belfiore = row[2] === "ND" ? null : String(row[2]);
    const entry = Object.freeze({ istatCode, name, belfiore, sourceRow: Number(row[3]) });
    if (byIstat.has(istatCode)) throw new Error(`SITUAS_DUPLICATE_ID: ${istatCode} ${snap.date}`);
    byIstat.set(istatCode, entry);
    if (belfiore) {
      const matches = byCode.get(belfiore) ?? [];
      matches.push(entry);
      byCode.set(belfiore, matches);
    }
  }
  dayIndex.set(snap.date, { report: snap.report, byIstat, byCode });
}

const validDate = (value: string) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined || year < 1861 || year > 2100) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
};

function result(status: ExactDateStatus115, date: string, report: number | null,
  municipality: MunicipalityExactCandidate115 | null = null): ExactDateResult115 {
  return {
    status, verifiedDate: date, sourceReport: report, sourceVersion: frozen.version,
    dayValidity: "OFFICIAL_SINGLE_DAY_ONLY", officialAssignment: false,
    municipality: municipality && { ...municipality },
  };
}

/** Date and 6-digit ISTAT code must match an actually downloaded source row. */
export function lookupItalianMunicipalityAtCertifiedDate115(istatCode: string, date: string): ExactDateResult115 {
  if (typeof istatCode !== "string" || !/^\d{6}$/u.test(istatCode)) return result("INVALID_IDENTIFIER", date, null);
  if (!validDate(date)) return result("INVALID_DATE", date, null);
  const snap = dayIndex.get(date);
  if (!snap) return result("DATE_NOT_PINNED", date, null);
  const candidate = snap.byIstat.get(istatCode);
  if (!candidate) return result("NOT_ACTIVE_AT_DATE", date, snap.report);
  if (!candidate.belfiore) return result("OFFICIAL_CODE_UNAVAILABLE", date, snap.report, candidate);
  return result("ATTESTED_AT_EXACT_DATE", date, snap.report, candidate);
}

/** Multiple municipalities can share a code across time; only the one pinned date is examined. */
export function findItalianMunicipalitiesByBelfioreAtCertifiedDate115(belfiore: string, date: string): {
  readonly status: "INVALID_IDENTIFIER" | "INVALID_DATE" | "DATE_NOT_PINNED" | "NOT_IN_SNAPSHOT" | "CANDIDATES_AT_EXACT_DATE";
  readonly sourceReport: number | null;
  readonly verifiedDate: string;
  readonly sourceVersion: string;
  readonly officialAssignment: false;
  readonly candidates: readonly MunicipalityExactCandidate115[];
} {
  const base = (status: "INVALID_IDENTIFIER" | "INVALID_DATE" | "DATE_NOT_PINNED" | "NOT_IN_SNAPSHOT" | "CANDIDATES_AT_EXACT_DATE",
    report: number | null, candidates: readonly MunicipalityExactCandidate115[] = []) => ({
    status, sourceReport: report, verifiedDate: date, sourceVersion: frozen.version, officialAssignment: false as const,
    candidates: candidates.map((candidate) => ({ ...candidate })),
  });
  if (typeof belfiore !== "string" || !/^[A-Z][0-9]{3}$/u.test(belfiore)) return base("INVALID_IDENTIFIER", null);
  if (!validDate(date)) return base("INVALID_DATE", null);
  const snap = dayIndex.get(date);
  if (!snap) return base("DATE_NOT_PINNED", null);
  const matching = snap.byCode.get(belfiore) ?? [];
  return matching.length ? base("CANDIDATES_AT_EXACT_DATE", snap.report, matching) : base("NOT_IN_SNAPSHOT", snap.report);
}
