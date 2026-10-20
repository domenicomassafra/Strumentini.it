/**
 * Version selection for source-pinned Italian fiscal excerpts. This is a local
 * revision ledger, not a declaration that the complete annual pack is ready.
 * In particular, an amended tax year cannot silently replace an older result.
 */
export interface FiscalRevision409 {
  readonly revisionId: string;
  readonly taxYear: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly checkedAt: string;
  readonly amendmentKind: "YEAR_BASELINE" | "RETROACTIVE_AMENDMENT";
  readonly supersedesRevisionId: string | null;
  /** Explicitly absent until a qualified annual fiscal source owner signs off. */
  readonly reviewOwner: string | null;
  readonly sources: readonly { readonly url: string; readonly sha256: `sha256:${string}` }[];
}

export interface FiscalBand409 {
  readonly upToCents: number | null;
  readonly rateBasisPoints: number;
}

const validDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
};

/** Validates the whole chronological chain before allowing any lookup. */
export function selectFiscalRevision409<T extends FiscalRevision409>(
  revisions: readonly T[], taxYear: number, revisionId?: string,
): T {
  if (revisions.length > 64) throw new Error("FISCAL409_REVISION_LIMIT");
  const seen = new Map<string, T>();
  for (const row of revisions) {
    if (!row.revisionId || seen.has(row.revisionId)) throw new Error("FISCAL409_DUPLICATE_REVISION");
    if (!Number.isSafeInteger(row.taxYear) || row.taxYear < 1900 || row.taxYear > 2200
      || ![row.effectiveFrom, row.effectiveTo, row.checkedAt].every(validDate)
      || row.effectiveFrom > row.effectiveTo
      || row.effectiveFrom.slice(0, 4) !== String(row.taxYear)
      || row.effectiveTo.slice(0, 4) !== String(row.taxYear)) {
      throw new Error("FISCAL409_INVALID_DATE");
    }
    if (row.sources.length === 0 || row.sources.length > 8 || row.sources.some((source) => !/^https:\/\//u.test(source.url)
      || !/^sha256:[a-f0-9]{64}$/u.test(source.sha256))) {
      throw new Error("FISCAL409_INVALID_SOURCE");
    }
    if (row.amendmentKind === "RETROACTIVE_AMENDMENT") {
      const previous = row.supersedesRevisionId ? seen.get(row.supersedesRevisionId) : undefined;
      if (!previous || previous.taxYear !== row.taxYear || row.checkedAt <= previous.checkedAt
        || row.effectiveFrom < previous.effectiveFrom || row.effectiveTo > previous.effectiveTo
        || !row.reviewOwner?.trim()
        || row.sources.every((source) => previous.sources.some((old) => old.sha256 === source.sha256))) {
        throw new Error("FISCAL409_INVALID_AMENDMENT");
      }
    } else if (row.amendmentKind !== "YEAR_BASELINE" || row.supersedesRevisionId !== null
      || [...seen.values()].some((old) => old.taxYear === row.taxYear)) {
      throw new Error("FISCAL409_INVALID_AMENDMENT");
    }
    seen.set(row.revisionId, row);
  }
  const candidates = revisions.filter((row) => row.taxYear === taxYear);
  if (candidates.length === 0 || (revisionId && !seen.has(revisionId))) {
    throw new Error(`FISCAL409_UNKNOWN_REVISION: ${taxYear} ${revisionId ?? ""}`);
  }
  if (!revisionId && candidates.length > 1) throw new Error(`FISCAL409_EXPLICIT_REVISION_REQUIRED: ${taxYear}`);
  const selected = revisionId ? seen.get(revisionId)! : candidates[0]!;
  if (selected.taxYear !== taxYear) throw new Error(`FISCAL409_UNKNOWN_REVISION: ${taxYear} ${revisionId}`);
  return selected;
}

/** The diff compares snapshots; it never mutates or upgrades either version. */
export function diffFiscalBands409<
  T extends FiscalRevision409 & { readonly bands: readonly FiscalBand409[] },
>(previous: T, next: T) {
  const changedBands = [] as { upToCents: number | null; previousBasisPoints: number | null; nextBasisPoints: number | null }[];
  const count = Math.max(previous.bands.length, next.bands.length);
  for (let index = 0; index < count; index++) {
    const before = previous.bands[index];
    const after = next.bands[index];
    if (before?.upToCents !== after?.upToCents || before?.rateBasisPoints !== after?.rateBasisPoints) {
      changedBands.push({ upToCents: after?.upToCents ?? before?.upToCents ?? null,
        previousBasisPoints: before?.rateBasisPoints ?? null, nextBasisPoints: after?.rateBasisPoints ?? null });
    }
  }
  const previousHashes = new Set(previous.sources.map((source) => source.sha256));
  const nextHashes = new Set(next.sources.map((source) => source.sha256));
  return {
    previousRevisionId: previous.revisionId, nextRevisionId: next.revisionId,
    previousEffectiveFrom: previous.effectiveFrom, nextEffectiveFrom: next.effectiveFrom,
    previousCheckedAt: previous.checkedAt, nextCheckedAt: next.checkedAt,
    addedSourceHashes: [...nextHashes].filter((sha) => !previousHashes.has(sha)),
    removedSourceHashes: [...previousHashes].filter((sha) => !nextHashes.has(sha)),
    changedBands,
  };
}
