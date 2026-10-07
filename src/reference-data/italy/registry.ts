import type {
  ItalyOfficialSource,
  ItalyReferenceBoundaryFixture,
  ItalyReferenceMetadata,
  ItalyReferenceProvenance,
  ItalyReferenceVersion,
  ItalyReferenceValidity,
} from "./types";

export type ItalyReferenceErrorCode =
  | "AMBIGUOUS_REFERENCE_DATA"
  | "INVALID_REFERENCE_DATA"
  | "UNKNOWN_BOUNDARY_TARGET"
  | "UNKNOWN_REFERENCE_DATASET"
  | "UNKNOWN_REFERENCE_VERSION"
  | "UNSUPPORTED_REFERENCE_DATE"
  | "UNSUPPORTED_REFERENCE_YEAR";

export class ItalyReferenceDataError extends Error {
  readonly code: ItalyReferenceErrorCode;
  readonly datasetId: string | null;
  readonly requested: string | number | null;

  constructor(
    code: ItalyReferenceErrorCode,
    message: string,
    details: { readonly datasetId?: string; readonly requested?: string | number } = {},
  ) {
    super(message);
    this.name = "ItalyReferenceDataError";
    this.code = code;
    this.datasetId = details.datasetId ?? null;
    this.requested = details.requested ?? null;
  }
}

type AnyItalyReferenceVersion = ItalyReferenceVersion<unknown, unknown, unknown>;

export interface ItalyReferenceRegistry<TVersion extends AnyItalyReferenceVersion = AnyItalyReferenceVersion> {
  readonly versions: readonly TVersion[];
  listMetadata(datasetId?: string): readonly ItalyReferenceMetadata[];
  byVersion(datasetId: string, version: string): TVersion;
  byYear(datasetId: string, year: number): TVersion;
  atDate(datasetId: string, date: string): TVersion;
}

export function createItalyReferenceRegistry<const TVersion extends AnyItalyReferenceVersion>(
  versions: readonly TVersion[],
): ItalyReferenceRegistry<TVersion> {
  const entries: readonly TVersion[] = Object.freeze([...versions]);
  validateRegistry(entries);

  function datasetEntries(datasetId: string): readonly TVersion[] {
    const matches = entries.filter((entry) => entry.metadata.datasetId === datasetId);
    if (matches.length === 0) {
      throw new ItalyReferenceDataError(
        "UNKNOWN_REFERENCE_DATASET",
        `Unknown Italy reference dataset: ${datasetId}`,
        { datasetId },
      );
    }
    return matches;
  }

  return {
    versions: entries,
    listMetadata(datasetId) {
      const selected = datasetId === undefined ? entries : datasetEntries(datasetId);
      return selected.map((entry) => entry.metadata);
    },
    byVersion(datasetId, version) {
      const match = datasetEntries(datasetId).find((entry) => entry.metadata.version === version);
      if (match === undefined) {
        throw new ItalyReferenceDataError(
          "UNKNOWN_REFERENCE_VERSION",
          `Unsupported version ${version} for Italy reference dataset ${datasetId}`,
          { datasetId, requested: version },
        );
      }
      return match;
    },
    byYear(datasetId, year) {
      if (!Number.isInteger(year)) {
        throw invalid(`Reference year must be an integer: ${year}`, datasetId, year);
      }
      const matches = datasetEntries(datasetId).filter((entry) => entry.metadata.year === year);
      if (matches.length === 0) {
        throw new ItalyReferenceDataError(
          "UNSUPPORTED_REFERENCE_YEAR",
          `Unsupported year ${year} for Italy reference dataset ${datasetId}`,
          { datasetId, requested: year },
        );
      }
      if (matches.length > 1) {
        throw ambiguous(datasetId, `year ${year}`);
      }
      return matches[0]!;
    },
    atDate(datasetId, date) {
      assertIsoDate(date, "lookup date", datasetId);
      const matches = datasetEntries(datasetId).filter((entry) => containsDate(entry.metadata.validity, date));
      if (matches.length === 0) {
        throw new ItalyReferenceDataError(
          "UNSUPPORTED_REFERENCE_DATE",
          `Unsupported date ${date} for Italy reference dataset ${datasetId}`,
          { datasetId, requested: date },
        );
      }
      if (matches.length > 1) {
        throw ambiguous(datasetId, `date ${date}`);
      }
      return matches[0]!;
    },
  };
}

export function getItalyReferenceProvenance(version: AnyItalyReferenceVersion): ItalyReferenceProvenance {
  const { metadata } = version;
  return {
    datasetId: metadata.datasetId,
    domain: metadata.domain,
    version: metadata.version,
    year: metadata.year ?? null,
    validity: metadata.validity,
    checkedAt: metadata.checkedAt,
    snapshotHash: metadata.snapshotHash,
    sources: metadata.sources,
  };
}

export function loadItalyReferenceBoundaryFixtures<TInput, TExpected>(
  version: ItalyReferenceVersion<unknown, TInput, TExpected>,
  targetId?: string,
): readonly ItalyReferenceBoundaryFixture<TInput, TExpected>[] {
  const fixtures = version.boundaryFixtures ?? [];
  if (targetId === undefined) return fixtures;
  const matches = fixtures.filter((fixture) => fixture.targetId === targetId);
  if (matches.length === 0) {
    throw new ItalyReferenceDataError(
      "UNKNOWN_BOUNDARY_TARGET",
      `Unknown boundary target ${targetId} for Italy reference dataset ${version.metadata.datasetId}`,
      { datasetId: version.metadata.datasetId, requested: targetId },
    );
  }
  return matches;
}

function validateRegistry(entries: readonly AnyItalyReferenceVersion[]): void {
  const seenVersions = new Set<string>();
  const seenYears = new Set<string>();

  for (const entry of entries) {
    validateVersion(entry);
    const { datasetId, version, year } = entry.metadata;
    const versionKey = `${datasetId}\u0000${version}`;
    if (seenVersions.has(versionKey)) {
      throw invalid(`Duplicate version ${version} for Italy reference dataset ${datasetId}`, datasetId, version);
    }
    seenVersions.add(versionKey);

    if (year !== undefined) {
      const yearKey = `${datasetId}\u0000${year}`;
      if (seenYears.has(yearKey)) throw ambiguous(datasetId, `year ${year}`);
      seenYears.add(yearKey);
    }
  }

  const grouped = new Map<string, AnyItalyReferenceVersion[]>();
  for (const entry of entries) {
    const group = grouped.get(entry.metadata.datasetId) ?? [];
    group.push(entry);
    grouped.set(entry.metadata.datasetId, group);
  }
  for (const [datasetId, versions] of grouped) {
    const sorted = [...versions].sort((left, right) => left.metadata.validity.from.localeCompare(right.metadata.validity.from));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]!;
      const current = sorted[index]!;
      if (previous.metadata.validity.to === null || previous.metadata.validity.to >= current.metadata.validity.from) {
        throw ambiguous(datasetId, `effective intervals ${formatValidity(previous.metadata.validity)} and ${formatValidity(current.metadata.validity)}`);
      }
    }
  }
}

function validateVersion(entry: AnyItalyReferenceVersion): void {
  const { metadata } = entry;
  assertNonEmpty(metadata.datasetId, "datasetId");
  assertNonEmpty(metadata.version, "version", metadata.datasetId);
  assertIsoDate(metadata.validity.from, "validity.from", metadata.datasetId);
  if (metadata.validity.to !== null) {
    assertIsoDate(metadata.validity.to, "validity.to", metadata.datasetId);
    if (metadata.validity.to < metadata.validity.from) {
      throw invalid("validity.to must be on or after validity.from", metadata.datasetId);
    }
  }
  assertIsoDate(metadata.checkedAt, "checkedAt", metadata.datasetId);
  if (metadata.year !== undefined && !Number.isInteger(metadata.year)) {
    throw invalid("reference year must be an integer", metadata.datasetId, metadata.year);
  }
  if (!/^sha256:[0-9a-f]{64}$/u.test(metadata.snapshotHash)) {
    throw invalid("snapshotHash must use sha256:<64 lowercase hex characters>", metadata.datasetId);
  }
  if (metadata.sources.length === 0) {
    throw invalid("at least one official source is required", metadata.datasetId);
  }
  for (const source of metadata.sources) validateSource(source, metadata.datasetId);

  const targets = new Set<string>();
  for (const fixture of entry.boundaryFixtures ?? []) {
    assertNonEmpty(fixture.targetId, "boundary targetId", metadata.datasetId);
    assertNonEmpty(fixture.description, "boundary description", metadata.datasetId);
    if (targets.has(fixture.targetId)) {
      throw invalid(`duplicate boundary target ${fixture.targetId}`, metadata.datasetId, fixture.targetId);
    }
    targets.add(fixture.targetId);
    if (fixture.cases.length === 0) {
      throw invalid(`boundary target ${fixture.targetId} must contain at least one case`, metadata.datasetId, fixture.targetId);
    }
    const caseIds = new Set<string>();
    for (const testCase of fixture.cases) {
      assertNonEmpty(testCase.id, "boundary case id", metadata.datasetId);
      if (caseIds.has(testCase.id)) {
        throw invalid(`duplicate boundary case ${testCase.id} for ${fixture.targetId}`, metadata.datasetId, testCase.id);
      }
      caseIds.add(testCase.id);
    }
  }
}

function validateSource(source: ItalyOfficialSource, datasetId: string): void {
  if (source.type !== "official-authority") {
    throw invalid("Italy normative reference sources must be official authorities", datasetId);
  }
  assertNonEmpty(source.authority, "source authority", datasetId);
  assertNonEmpty(source.title, "source title", datasetId);
  assertNonEmpty(source.url, "source URL", datasetId);
  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    throw invalid(`source URL is invalid: ${source.url}`, datasetId);
  }
  if (url.protocol !== "https:") throw invalid(`source URL must use HTTPS: ${source.url}`, datasetId);
  if (source.publishedAt !== undefined) assertIsoDate(source.publishedAt, "source publishedAt", datasetId);
}

function containsDate(validity: ItalyReferenceValidity, date: string): boolean {
  return validity.from <= date && (validity.to === null || date <= validity.to);
}

function formatValidity(validity: ItalyReferenceValidity): string {
  return `${validity.from}..${validity.to ?? "open"}`;
}

function assertNonEmpty(value: string, field: string, datasetId?: string): void {
  if (value.trim().length === 0) throw invalid(`${field} must not be empty`, datasetId);
}

function assertIsoDate(value: string, field: string, datasetId?: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw invalid(`${field} must be YYYY-MM-DD`, datasetId, value);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) {
    throw invalid(`${field} is not a valid calendar date`, datasetId, value);
  }
}

function invalid(message: string, datasetId?: string, requested?: string | number): ItalyReferenceDataError {
  return new ItalyReferenceDataError("INVALID_REFERENCE_DATA", message, {
    ...(datasetId === undefined ? {} : { datasetId }),
    ...(requested === undefined ? {} : { requested }),
  });
}

function ambiguous(datasetId: string, requested: string): ItalyReferenceDataError {
  return new ItalyReferenceDataError(
    "AMBIGUOUS_REFERENCE_DATA",
    `Ambiguous ${requested} for Italy reference dataset ${datasetId}`,
    { datasetId, requested },
  );
}
