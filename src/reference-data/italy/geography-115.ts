import snapshot from "./geography-115.snapshot.json";

/** #115: offline official-source candidates; this is NOT birth-date validation.
 * Current municipalities are exact as of 2026-02-21. SITUAS suppressed rows
 * list changes (not complete periods of existence); foreign rows do not expose
 * effective periods. Never backfill a missing code from a successor entity.
 */
export type ItalianGeographyKind115 = "current" | "suppressed" | "foreign";
export type ItalianGeographyCodeStatus115 = "CODE_AVAILABLE" | "OFFICIAL_CODE_UNAVAILABLE" | "NOT_IN_SNAPSHOT" | "INVALID_IDENTIFIER";

export interface ItalianGeographyCandidate115 {
  readonly istatCode: string;
  readonly name: string;
  readonly belfiore: string | null;
  readonly provenance: "ISTAT_CURRENT_2026_02_21" | "SITUAS_SUPPRESSED_128" | "SITUAS_FOREIGN_469";
  readonly changeDate?: string;
  readonly changeType?: string;
  /** Relationships are descriptive, never a replacement for an absent historical code. */
  readonly relatedIstatCode?: string | null;
  readonly relatedBelfiore?: string | null;
  readonly sourceRow?: number;
  readonly type?: string;
}

export interface ItalianGeographyLookup115 {
  readonly status: ItalianGeographyCodeStatus115;
  readonly kind: ItalianGeographyKind115;
  readonly requestedIstatCode: string;
  readonly checkedAt: string;
  readonly version: string;
  /** Only current-2026-02-21 is verified for its date; other cases require temporal history. */
  readonly dateValidity: "SNAPSHOT_DATE_ONLY" | "NOT_VERIFIED";
  readonly candidates: readonly ItalianGeographyCandidate115[];
}

export const ITALIAN_GEOGRAPHY_115_METADATA = Object.freeze({
  version: snapshot.version,
  checkedAt: snapshot.checkedAt,
  currentMunicipalitiesAsOf: snapshot.currentMunicipalitiesAsOf,
  suppressedMunicipalitiesFrom: snapshot.suppressedMunicipalitiesFrom,
  foreignStatesFrom: snapshot.foreignStatesFrom,
  coverage: Object.freeze({ ...snapshot.coverage }),
  sourceSha256: Object.freeze({
    current: snapshot.sources.current.sha256,
    suppressed: snapshot.sources.suppressed.sha256,
    foreign: snapshot.sources.foreign.sha256,
  }),
});

type Candidate = ItalianGeographyCandidate115;
const indexed = {
  current: new Map<string, Candidate[]>(),
  suppressed: new Map<string, Candidate[]>(),
  foreign: new Map<string, Candidate[]>(),
};
function add(kind: ItalianGeographyKind115, candidate: Candidate): void {
  const matches = indexed[kind].get(candidate.istatCode) ?? [];
  matches.push(Object.freeze(candidate));
  indexed[kind].set(candidate.istatCode, matches);
}

for (const row of snapshot.current) {
  add("current", {
    istatCode: row.istatCode, name: row.name,
    belfiore: row.belfiore, provenance: "ISTAT_CURRENT_2026_02_21",
  });
}
for (const row of snapshot.suppressed) {
  add("suppressed", {
    istatCode: row.istatCode, name: row.name, belfiore: row.belfiore,
    provenance: "SITUAS_SUPPRESSED_128", changeDate: row.changeDate,
    changeType: row.changeType, relatedIstatCode: row.relatedIstatCode,
    relatedBelfiore: row.relatedBelfiore, sourceRow: row.sourceRow,
  });
}
for (const row of snapshot.foreign) {
  add("foreign", {
    istatCode: String(row.istatCode), name: row.name, belfiore: row.belfiore,
    provenance: "SITUAS_FOREIGN_469", type: row.type,
  });
}

/** Strict ID lookup, never a fuzzy name match or silent successor substitution.
 * For Codice Fiscale, a CODE_AVAILABLE result is only a candidate: historical
 * birth-date applicability is NOT proven by these sources.
 */
export function lookupItalianGeography115(kind: ItalianGeographyKind115, istatCode: string): ItalianGeographyLookup115 {
  const valid = kind === "foreign" ? /^[0-9]{3}$/u : /^[0-9]{6}$/u;
  const candidates = valid.test(istatCode) ? (indexed[kind].get(istatCode) ?? []) : [];
  const status = !valid.test(istatCode) ? "INVALID_IDENTIFIER"
    : candidates.length === 0 ? "NOT_IN_SNAPSHOT"
      : candidates.some(({ belfiore }) => belfiore !== null) ? "CODE_AVAILABLE" : "OFFICIAL_CODE_UNAVAILABLE";
  return {
    status, kind, requestedIstatCode: istatCode,
    checkedAt: snapshot.checkedAt, version: snapshot.version,
    dateValidity: kind === "current" ? "SNAPSHOT_DATE_ONLY" : "NOT_VERIFIED",
    candidates: candidates.map((candidate) => ({ ...candidate })),
  };
}

/** Local name/ISTAT-code search over the exact pinned official rows; never substitutes missing Belfiore codes. */
export function searchItalianGeography115(kind: ItalianGeographyKind115, query: string, limit = 20): readonly ItalianGeographyCandidate115[] {
  if (kind !== "current" && kind !== "suppressed" && kind !== "foreign") throw new Error("INVALID_GEOGRAPHY_KIND");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("INVALID_GEOGRAPHY_LIMIT");
  const normalized = (text: string) => text.normalize("NFD").replace(/\p{Mark}/gu, "").toLocaleLowerCase("it-IT");
  const needle = normalized(query.trim());
  if (needle.length < 2 || needle.length > 80) return [];
  const candidates = [...indexed[kind].values()].flat();
  return candidates.filter((row) => normalized(row.name).includes(needle) || row.istatCode.startsWith(needle))
    .sort((a, b) => a.name.localeCompare(b.name, "it") || a.istatCode.localeCompare(b.istatCode))
    .slice(0, limit);
}
