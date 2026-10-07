import { describe, expect, it } from "vitest";
import {
  ItalyReferenceDataError,
  createItalyReferenceRegistry,
  getItalyReferenceProvenance,
  loadItalyReferenceBoundaryFixtures,
  type ItalyReferenceVersion,
} from "../src/reference-data/italy";

const HASH_2025 = `sha256:${"1".repeat(64)}`;
const HASH_2026 = `sha256:${"2".repeat(64)}`;

interface SyntheticRules {
  readonly rate: number;
}

interface SyntheticInput {
  readonly amount: number;
}

interface SyntheticExpected {
  readonly band: string;
}

function syntheticVersion(
  year: number,
  from: string,
  to: string,
  rate: number,
  hash: string,
): ItalyReferenceVersion<SyntheticRules, SyntheticInput, SyntheticExpected> {
  return {
    metadata: {
      datasetId: "synthetic-fiscal-rules",
      domain: "fiscal",
      version: `synthetic-${year}`,
      year,
      validity: { from, to },
      checkedAt: `${year}-02-01`,
      snapshotHash: hash,
      sources: [
        {
          type: "official-authority",
          authority: "Autorità pubblica sintetica per test",
          title: `Documento sintetico ${year}`,
          url: `https://authority.invalid/rules/${year}`,
          publishedAt: `${year}-01-15`,
        },
      ],
    },
    data: { rate },
    boundaryFixtures: [
      {
        targetId: "rate-threshold",
        kind: "threshold",
        description: "Synthetic threshold used only to verify boundary fixture routing.",
        boundaryValue: 100,
        cases: [
          { id: "below", position: "below", input: { amount: 99 }, expected: { band: "lower" } },
          { id: "at", position: "at", input: { amount: 100 }, expected: { band: "upper" } },
          { id: "above", position: "above", input: { amount: 101 }, expected: { band: "upper" } },
        ],
      },
      {
        targetId: "annual-rate-change",
        kind: "rate-change",
        description: "Synthetic annual rate change used only by framework tests.",
        cases: [
          { id: "effective", position: "at", input: { amount: 1 }, expected: { band: String(rate) } },
        ],
      },
    ],
  };
}

const VERSION_2025 = syntheticVersion(2025, "2025-01-01", "2025-12-31", 0.1, HASH_2025);
const VERSION_2026 = syntheticVersion(2026, "2026-01-01", "2026-12-31", 0.2, HASH_2026);

function referenceError(run: () => unknown): ItalyReferenceDataError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ItalyReferenceDataError);
    return error as ItalyReferenceDataError;
  }
  throw new Error("Expected ItalyReferenceDataError");
}

describe("versioned Italy reference data", () => {
  it("selects a version explicitly by annual reference year or effective date", () => {
    const registry = createItalyReferenceRegistry([VERSION_2025, VERSION_2026]);

    expect(registry.byYear("synthetic-fiscal-rules", 2025).metadata.version).toBe("synthetic-2025");
    expect(registry.byYear("synthetic-fiscal-rules", 2026).data).toEqual({ rate: 0.2 });
    expect(registry.atDate("synthetic-fiscal-rules", "2025-12-31").metadata.year).toBe(2025);
    expect(registry.atDate("synthetic-fiscal-rules", "2026-01-01").metadata.year).toBe(2026);
    expect(registry.byVersion("synthetic-fiscal-rules", "synthetic-2025").metadata.snapshotHash).toBe(HASH_2025);
  });

  it("fails honestly for an unsupported newer year instead of reusing the latest rules", () => {
    const registry = createItalyReferenceRegistry([VERSION_2025, VERSION_2026]);

    expect(referenceError(() => registry.byYear("synthetic-fiscal-rules", 2027))).toMatchObject({
      code: "UNSUPPORTED_REFERENCE_YEAR",
      datasetId: "synthetic-fiscal-rules",
      requested: 2027,
    });
    expect(referenceError(() => registry.atDate("synthetic-fiscal-rules", "2027-01-01"))).toMatchObject({
      code: "UNSUPPORTED_REFERENCE_DATE",
    });
  });

  it("exposes official-source provenance without the normative data payload", () => {
    const provenance = getItalyReferenceProvenance(VERSION_2026);

    expect(provenance).toEqual({
      datasetId: "synthetic-fiscal-rules",
      domain: "fiscal",
      version: "synthetic-2026",
      year: 2026,
      validity: { from: "2026-01-01", to: "2026-12-31" },
      checkedAt: "2026-02-01",
      snapshotHash: HASH_2026,
      sources: VERSION_2026.metadata.sources,
    });
    expect(provenance.sources[0]).toMatchObject({
      type: "official-authority",
      authority: "Autorità pubblica sintetica per test",
      url: "https://authority.invalid/rules/2026",
    });
    expect(provenance).not.toHaveProperty("data");
  });

  it("loads all boundary fixtures or one stable target", () => {
    const all = loadItalyReferenceBoundaryFixtures(VERSION_2026);
    const threshold = loadItalyReferenceBoundaryFixtures(VERSION_2026, "rate-threshold");

    expect(all.map((fixture) => fixture.targetId)).toEqual(["rate-threshold", "annual-rate-change"]);
    expect(threshold).toHaveLength(1);
    expect(threshold[0]?.cases.map((testCase) => testCase.position)).toEqual(["below", "at", "above"]);
    expect(referenceError(() => loadItalyReferenceBoundaryFixtures(VERSION_2026, "missing-threshold"))).toMatchObject({
      code: "UNKNOWN_BOUNDARY_TARGET",
    });
  });

  it("rejects ambiguous effective intervals and source packs without official provenance", () => {
    const overlapping = syntheticVersion(2027, "2026-12-01", "2027-12-31", 0.3, `sha256:${"3".repeat(64)}`);
    expect(referenceError(() => createItalyReferenceRegistry([VERSION_2026, overlapping]))).toMatchObject({
      code: "AMBIGUOUS_REFERENCE_DATA",
    });

    const invalidSource: ItalyReferenceVersion = {
      ...VERSION_2026,
      metadata: {
        ...VERSION_2026.metadata,
        datasetId: "invalid-source",
        sources: [{
          type: "unofficial" as "official-authority",
          authority: "Synthetic",
          title: "Non-authoritative test source",
          url: "https://example.invalid/rules",
        }],
      },
    };
    expect(referenceError(() => createItalyReferenceRegistry([invalidSource]))).toMatchObject({
      code: "INVALID_REFERENCE_DATA",
    });
  });
});
