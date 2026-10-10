import raw from "./geography-115-anpr-history.snapshot.json";

/**
 * #115: supplemental official CC-BY ANPR archive, NOT a replacement for ISTAT.
 * Validity is that of the archived ANPR administrative record, not proof of an
 * Agenzia-issued Codice Fiscale to any person. The 2023 archive cannot certify
 * later state; official ND codes stay unavailable and names are not joined.
 */
export const ANPR_HISTORICAL_115_METADATA = Object.freeze({
  version: raw.version,
  publishedArchiveRevision: raw.publishedArchiveRevision,
  lastRepoCommitAt: raw.lastRepoCommitAt,
  coverageUpperBound: raw.lastRepoCommitAt,
  license: raw.license,
  rows: raw.rows.length,
  sourceSha256: Object.freeze({ ...raw.sourceSha256 }),
  artifacts: Object.freeze([
    { path: "quality/reference-data/italy/artifacts/115-administrative-geography/anpr-archivio-comuni-2023-10-03.csv", sha256: raw.sourceSha256.csv },
    { path: "quality/reference-data/italy/artifacts/115-administrative-geography/anpr-archivio-comuni-legenda-2019-v001.md", sha256: raw.sourceSha256.legend },
  ]),
});

export interface AnprHistoricalMunicipality115 {
  readonly istatCode: string;
  readonly name: string;
  readonly belfiore: string | null;
  readonly validFrom: string;
  readonly validTo: string;
  readonly archivedState: "A" | "C";
  readonly sourceRow: number;
  readonly source: "ANPR_OFFICIAL_ARCHIVE_2023_10_03";
}

type MatchStatus = "OFFICIAL_ADMINISTRATIVE_INTERVAL_MATCH" | "AMBIGUOUS_ADMINISTRATIVE_INTERVAL"
  | "OFFICIAL_CODE_UNAVAILABLE" | "NO_MATCH_FOR_DATE" | "NOT_IN_ANPR_ARCHIVE"
  | "INVALID_IDENTIFIER" | "INVALID_DATE" | "DATE_AFTER_ARCHIVE";

export interface AnprHistoricalLookup115 {
  readonly status: MatchStatus;
  readonly dateValidity: "ANPR_ADMINISTRATIVE_RECORD_ONLY";
  readonly officialFiscalAssignment: false;
  readonly source: "ANPR_OFFICIAL_ARCHIVE_2023_10_03";
  readonly version: string;
  readonly candidates: readonly AnprHistoricalMunicipality115[];
}

const byIstat = new Map<string, AnprHistoricalMunicipality115[]>();
const byBelfiore = new Map<string, AnprHistoricalMunicipality115[]>();
for (const row of raw.rows) {
  const [istatCode, name, originalCode, validFrom, validTo, state, sourceRow] = row;
  const item: AnprHistoricalMunicipality115 = Object.freeze({
    istatCode: String(istatCode), name: String(name), belfiore: originalCode === "ND" ? null : String(originalCode),
    validFrom: String(validFrom), validTo: String(validTo), archivedState: state as "A" | "C",
    sourceRow: Number(sourceRow), source: "ANPR_OFFICIAL_ARCHIVE_2023_10_03",
  });
  const indexed = byIstat.get(item.istatCode) ?? [];
  indexed.push(item);
  byIstat.set(item.istatCode, indexed);
  if (item.belfiore !== null) {
    const reverse = byBelfiore.get(item.belfiore) ?? [];
    reverse.push(item);
    byBelfiore.set(item.belfiore, reverse);
  }
}

function validDate(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined || y < 1861 || y > 9998) return false;
  const test = new Date(Date.UTC(y, m - 1, d));
  return test.getUTCFullYear() === y && test.getUTCMonth() === m - 1 && test.getUTCDate() === d;
}

function lookup(status: MatchStatus, candidates: readonly AnprHistoricalMunicipality115[] = []): AnprHistoricalLookup115 {
  return {
    status, dateValidity: "ANPR_ADMINISTRATIVE_RECORD_ONLY", officialFiscalAssignment: false,
    source: "ANPR_OFFICIAL_ARCHIVE_2023_10_03", version: raw.version,
    candidates: candidates.map((candidate) => ({ ...candidate })),
  };
}

function selectInDate(rows: readonly AnprHistoricalMunicipality115[], day: string): AnprHistoricalLookup115 {
  if (!validDate(day)) return lookup("INVALID_DATE");
  if (day > raw.lastRepoCommitAt) return lookup("DATE_AFTER_ARCHIVE");
  const matches = rows.filter((row) => day >= row.validFrom && day <= row.validTo);
  if (matches.length === 0) return lookup("NO_MATCH_FOR_DATE");
  if (matches.some((row) => row.belfiore === null)) return lookup("OFFICIAL_CODE_UNAVAILABLE", matches);
  if (new Set(matches.map((row) => row.belfiore)).size > 1) return lookup("AMBIGUOUS_ADMINISTRATIVE_INTERVAL", matches);
  return lookup("OFFICIAL_ADMINISTRATIVE_INTERVAL_MATCH", matches);
}

/** Requires the exact ISTAT identifier, never a possibly duplicated place name. */
export function lookupAnprHistoricalMunicipality115(istatCode: string, day: string): AnprHistoricalLookup115 {
  if (typeof istatCode !== "string" || !/^\d{6}$/u.test(istatCode)) return lookup("INVALID_IDENTIFIER");
  const matches = byIstat.get(istatCode);
  if (!matches) return lookup("NOT_IN_ANPR_ARCHIVE");
  return selectInDate(matches, day);
}

/** Reverse historical *candidates*, not a unique person or official CF assignment. */
export function findAnprHistoricalBelfiore115(belfiore: string, day: string): AnprHistoricalLookup115 {
  if (typeof belfiore !== "string" || !/^[A-Z][0-9]{3}$/u.test(belfiore)) return lookup("INVALID_IDENTIFIER");
  return selectInDate(byBelfiore.get(belfiore) ?? [], day);
}
