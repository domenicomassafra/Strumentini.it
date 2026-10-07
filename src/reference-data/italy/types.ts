export type ItalyReferenceDomain =
  | "administrative"
  | "calendar"
  | "fiscal"
  | "social-security"
  | "technical";

export interface ItalyReferenceValidity {
  /** Inclusive ISO calendar date (YYYY-MM-DD). */
  readonly from: string;
  /** Inclusive ISO calendar date, or null when the version remains open-ended. */
  readonly to: string | null;
}

export interface ItalyOfficialSource {
  /** Italy reference packs may cite normative values only from official authorities. */
  readonly type: "official-authority";
  readonly authority: string;
  readonly title: string;
  readonly url: string;
  /** Optional publication date when the authority exposes one. */
  readonly publishedAt?: string;
}

export interface ItalyReferenceMetadata {
  /** Stable logical dataset identifier, for example `irpef-national` or `comuni`. */
  readonly datasetId: string;
  readonly domain: ItalyReferenceDomain;
  /** Stable source-pack version. It is independent from a calculator release. */
  readonly version: string;
  /** Calendar/tax reference year when the source pack is naturally annual. */
  readonly year?: number;
  readonly validity: ItalyReferenceValidity;
  /** Date on which the packaged sources were last checked against the authority. */
  readonly checkedAt: string;
  /** SHA-256 of the canonical packaged snapshot, formatted as `sha256:<hex>`. */
  readonly snapshotHash: string;
  readonly sources: readonly ItalyOfficialSource[];
}

export type ItalyBoundaryKind =
  | "bracket"
  | "code-change"
  | "coefficient-change"
  | "effective-date"
  | "rate-change"
  | "threshold";

export type ItalyBoundaryPosition = "below" | "at" | "above" | "before" | "after";

export interface ItalyReferenceBoundaryCase<TInput = unknown, TExpected = unknown> {
  readonly id: string;
  readonly position: ItalyBoundaryPosition;
  readonly input: TInput;
  readonly expected: TExpected;
}

export interface ItalyReferenceBoundaryFixture<TInput = unknown, TExpected = unknown> {
  /** Stable identifier for one rule edge, such as `second-bracket-start`. */
  readonly targetId: string;
  readonly kind: ItalyBoundaryKind;
  /** Human-readable explanation of the rule edge the fixture covers. */
  readonly description: string;
  /** Optional serialized boundary value; calculations decide how to interpret it. */
  readonly boundaryValue?: string | number;
  readonly cases: readonly ItalyReferenceBoundaryCase<TInput, TExpected>[];
}

export interface ItalyReferenceVersion<TData = unknown, TInput = unknown, TExpected = unknown> {
  readonly metadata: ItalyReferenceMetadata;
  readonly data: TData;
  readonly boundaryFixtures?: readonly ItalyReferenceBoundaryFixture<TInput, TExpected>[];
}

export interface ItalyReferenceProvenance {
  readonly datasetId: string;
  readonly domain: ItalyReferenceDomain;
  readonly version: string;
  readonly year: number | null;
  readonly validity: ItalyReferenceValidity;
  readonly checkedAt: string;
  readonly snapshotHash: string;
  readonly sources: readonly ItalyOfficialSource[];
}
