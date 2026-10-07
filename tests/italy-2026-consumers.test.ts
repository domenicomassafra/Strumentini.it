import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BridgeOptimizerError,
  EMPLOYEE_AGRICULTURAL_CONTRIBUTION_2026_AVAILABILITY,
  EMPLOYEE_GENERAL_CONTRIBUTION_2026_AVAILABILITY,
  FatturaPaReaderError,
  InpsContributionError,
  calculateArtigianiCommerciantiContribution,
  calculateEmployeeAgriculturalContribution,
  calculateGestioneSeparataContribution,
  optimizeItalianBridges,
  readFatturaPaXml,
} from "../src/engines/italy";
import {
  FATTURAPA_TECHNICAL_CURRENT,
  INPS_CONTRIBUTIONS_2026,
  ITALY_NATIONAL_HOLIDAYS_2026,
  createItalyReferenceRegistry,
} from "../src/reference-data/italy";

const root = process.cwd();

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

describe("Italy 2026 bounded consumer engines", () => {
  it("registers the three runtime packs with exact year/current identities and official provenance", () => {
    const registry = createItalyReferenceRegistry([
      INPS_CONTRIBUTIONS_2026,
      ITALY_NATIONAL_HOLIDAYS_2026,
      FATTURAPA_TECHNICAL_CURRENT,
    ]);
    expect(registry.byYear("inps-contributions-annual", 2026).metadata.snapshotHash).toBe(
      "sha256:144c00d1377760268abcdf47e88f6680b422570d190f6c3ecee3547fb640ad73",
    );
    expect(registry.byYear("italy-national-holidays", 2026).metadata.sources.every(({ type }) => type === "official-authority")).toBe(true);
    expect(registry.byVersion("fatturapa-technical-schema", "1.4-schema-1.2.3-1.0.2").data).toEqual(FATTURAPA_TECHNICAL_CURRENT.data);
    expect(() => registry.byYear("inps-contributions-annual", 2027)).toThrow(/Unsupported year 2027/u);
  });

  it("keeps the general employee contribution model fail-closed because source pack 118 does not cover it", () => {
    expect(EMPLOYEE_GENERAL_CONTRIBUTION_2026_AVAILABILITY).toMatchObject({
      year: 2026,
      supported: false,
      reason: expect.stringMatching(/cross-sector general employee profile is not inferred/iu),
    });
  });

  it("calculates only the pinned 2026 agricultural-worker FPLD profile and reconciles the derived employer share", async () => {
    const fixture = JSON.parse(
      await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/employee-agricultural-2026.json"), "utf8"),
    ) as {
      positiveCases: Array<{
        input: { contributionBaseEur: number; partTimeHourlyRemunerationEur?: number };
        expected: { workerContributionEur: number; employerContributionEur: number; totalFpldContributionEur: number };
      }>;
    };

    expect(EMPLOYEE_AGRICULTURAL_CONTRIBUTION_2026_AVAILABILITY).toMatchObject({
      year: 2026,
      supported: true,
      profiles: ["agricultural-worker-general"],
    });

    for (const vector of fixture.positiveCases) {
      const result = calculateEmployeeAgriculturalContribution({
        year: 2026,
        profile: "agricultural-worker-general",
        ...vector.input,
      });
      expect(result).toMatchObject({
        totalFpldRatePercent: 30.5,
        workerFpldRatePercent: 8.84,
        employerFpldRatePercent: 21.66,
        employerFpldRateDerivation: "total-minus-worker",
        dailyMinimumReferenceEur: 58.13,
        partTimeMinimumHourlyEur: 8.94,
        additionalOnePercentThresholdEur: 56224,
        sourceReportedAnnualBaseMaximumReferenceEur: 122295,
        ...vector.expected,
      });
      expect(result.workerContributionEur + result.employerContributionEur).toBeCloseTo(result.totalFpldContributionEur, 10);
      expect(result.provenance.snapshotHash).toBe("sha256:144c00d1377760268abcdf47e88f6680b422570d190f6c3ecee3547fb640ad73");
    }
  });

  it("fails closed at every bounded agricultural-worker v1 edge from the focused fixture", async () => {
    const fixture = JSON.parse(
      await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/employee-agricultural-2026.json"), "utf8"),
    ) as {
      rejectionCases: Array<{
        input: {
          year: number;
          profile: string;
          contributionBaseEur: number;
          partTimeHourlyRemunerationEur?: number;
        };
        expectedErrorCode: string;
      }>;
    };

    for (const vector of fixture.rejectionCases) {
      expect(() => calculateEmployeeAgriculturalContribution(vector.input)).toThrowError(
        expect.objectContaining<Partial<InpsContributionError>>({ code: vector.expectedErrorCode as InpsContributionError["code"] }),
      );
    }
  });

  it("binds ticket 129 evidence to the exact source-pack and focused-fixture bytes", async () => {
    const evidenceBytes = await readFile(resolve(root, "quality/reference-data/italy/129-employee-agricultural-calculator-evidence.json"));
    expect(sha256(evidenceBytes)).toBe("sha256:9784a82d6093bf83a10341778a5d8901124b6b37b74cc913421e6cd7a0e6482a");
    const evidence = JSON.parse(evidenceBytes.toString("utf8")) as {
      sourcePack: { path: string; sha256: string; datasetVersion: string };
      verificationFixture: { path: string; sha256: string };
      normalizedFacts: { employerFpldRateDerivation: string };
    };
    const sourcePackBytes = await readFile(resolve(root, evidence.sourcePack.path));
    const fixtureBytes = await readFile(resolve(root, evidence.verificationFixture.path));
    expect(evidence.sourcePack.datasetVersion).toBe("2026.2");
    expect(sha256(sourcePackBytes)).toBe(evidence.sourcePack.sha256);
    expect(sha256(fixtureBytes)).toBe(evidence.verificationFixture.sha256);
    expect(evidence.normalizedFacts.employerFpldRateDerivation).toMatch(/not a verbatim percentage/iu);
  });

  it("itemizes artigiano/commerciante minimum and threshold bands using the pinned 2026 rates", () => {
    const artisanMinimum = calculateArtigianiCommerciantiContribution({
      year: 2026,
      profile: "artigiano",
      incomeEur: 10_000,
      contributionSeniority: "before-1996",
    });
    expect(artisanMinimum).toMatchObject({
      contributionBaseEur: 18_808,
      totalContributionEur: 4_521.36,
      excludedAboveCeilingEur: 0,
    });
    expect(artisanMinimum.bands).toEqual([
      expect.objectContaining({ id: "minimum", baseEur: 18_808, contributionEur: 4_521.36 }),
      expect.objectContaining({ id: "first-band-excess", baseEur: 0, ratePercent: 24, contributionEur: 0 }),
      expect.objectContaining({ id: "second-band", baseEur: 0, ratePercent: 25, contributionEur: 0 }),
    ]);

    const artisanThreshold = calculateArtigianiCommerciantiContribution({
      year: 2026,
      profile: "artigiano",
      incomeEur: 56_224,
      contributionSeniority: "before-1996",
    });
    expect(artisanThreshold.totalContributionEur).toBe(13_501.2);
    expect(artisanThreshold.bands[1]).toMatchObject({ baseEur: 37_416, ratePercent: 24, contributionEur: 8_979.84 });
    expect(artisanThreshold.bands[2]).toMatchObject({ baseEur: 0, ratePercent: 25, contributionEur: 0 });

    const merchant = calculateArtigianiCommerciantiContribution({
      year: 2026,
      profile: "commerciante",
      incomeEur: 56_224,
      contributionSeniority: "from-1996",
    });
    expect(merchant.totalContributionEur).toBe(13_771.08);
    expect(merchant.bands[1]).toMatchObject({ ratePercent: 24.48, contributionEur: 9_159.44 });
  });

  it("caps autonomous contribution bases at the selected 2026 seniority maximum and rejects unsupported reductions", () => {
    const capped = calculateArtigianiCommerciantiContribution({
      year: 2026,
      profile: "artigiano",
      incomeEur: 100_000,
      contributionSeniority: "before-1996",
    });
    expect(capped).toMatchObject({ contributionBaseEur: 93_707, excludedAboveCeilingEur: 6_293, incomeMaximumEur: 93_707 });
    expect(capped.bands[2]).toMatchObject({ baseEur: 37_483, ratePercent: 25, contributionEur: 9_370.75 });
    expect(capped.totalContributionEur).toBe(22_871.95);

    expect(() => calculateArtigianiCommerciantiContribution({
      year: 2026,
      profile: "artigiano",
      incomeEur: 30_000,
      contributionSeniority: "from-1996",
      reduction: "forfettario-35",
    })).toThrowError(expect.objectContaining<Partial<InpsContributionError>>({ code: "UNSUPPORTED_ARTIGIANI_COMMERCIANTI_REDUCTION" }));
    expect(() => calculateArtigianiCommerciantiContribution({
      year: 2027,
      profile: "artigiano",
      incomeEur: 30_000,
      contributionSeniority: "from-1996",
    })).toThrowError(expect.objectContaining<Partial<InpsContributionError>>({ code: "UNSUPPORTED_INPS_YEAR" }));
  });

  it("treats the Gestione Separata minimum as a full-year-credit threshold instead of a contribution floor", () => {
    const lowIncome = calculateGestioneSeparataContribution({
      year: 2026,
      profile: "professional-no-other-mandatory-pension-coverage",
      incomeEur: 10_000,
    });
    expect(lowIncome).toMatchObject({
      contributionBaseEur: 10_000,
      totalContributionEur: 2_607,
      incomeMinimumForFullYearCreditEur: 18_808,
      contributionAtFullYearCreditMinimumEur: 4_903.25,
      belowFullYearCreditMinimum: true,
      ratePercent: 26.07,
    });
    expect(lowIncome.rateComponentsPercent).toEqual({ ivs: 25, additionalBenefits: 0.72, iscro: 0.35 });

    const coveredElsewhere = calculateGestioneSeparataContribution({
      year: 2026,
      profile: "professional-pensioner-or-other-mandatory-pension-coverage",
      incomeEur: 18_808,
    });
    expect(coveredElsewhere).toMatchObject({ ratePercent: 24, totalContributionEur: 4_513.92, belowFullYearCreditMinimum: false });
  });

  it("caps Gestione Separata at €122,295 and rejects profiles outside the normalized professional subset", () => {
    const capped = calculateGestioneSeparataContribution({
      year: 2026,
      profile: "professional-no-other-mandatory-pension-coverage",
      incomeEur: 130_000,
    });
    expect(capped).toMatchObject({
      contributionBaseEur: 122_295,
      excludedAboveCeilingEur: 7_705,
      totalContributionEur: 31_882.31,
    });
    expect(() => calculateGestioneSeparataContribution({
      year: 2026,
      profile: "parasubordinate",
      incomeEur: 30_000,
    })).toThrowError(expect.objectContaining<Partial<InpsContributionError>>({ code: "UNSUPPORTED_GESTIONE_SEPARATA_PROFILE" }));
  });

  it("finds deterministic bridge intervals around fixed and movable 2026 holidays", () => {
    const result = optimizeItalianBridges({
      year: 2026,
      leaveDayBudget: 4,
      workweek: ["MON", "TUE", "WED", "THU", "FRI"],
      maxResults: 100,
    });
    expect(result.provenance.snapshotHash).toBe(ITALY_NATIONAL_HOLIDAYS_2026.metadata.snapshotHash);
    expect(result.opportunities).toContainEqual(expect.objectContaining({
      startDate: "2026-04-04",
      endDate: "2026-04-12",
      consecutiveDaysOff: 9,
      leaveDaysUsed: 4,
      leaveDates: ["2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10"],
      holidays: [expect.objectContaining({ date: "2026-04-06", name: "Lunedì dopo Pasqua" })],
    }));
    expect(result.opportunities).toContainEqual(expect.objectContaining({
      startDate: "2026-04-25",
      endDate: "2026-05-03",
      consecutiveDaysOff: 9,
      leaveDaysUsed: 4,
      leaveDates: ["2026-04-27", "2026-04-28", "2026-04-29", "2026-04-30"],
      holidays: expect.arrayContaining([expect.objectContaining({ date: "2026-05-01" })]),
    }));
  });

  it("respects a custom workweek and fails closed outside the authoritative 2026 holiday year", () => {
    const custom = optimizeItalianBridges({
      year: 2026,
      leaveDayBudget: 0,
      workweek: ["TUE", "WED", "THU", "FRI", "SAT"],
      maxResults: 100,
    });
    expect(custom.opportunities).toContainEqual(expect.objectContaining({
      startDate: "2026-05-31",
      endDate: "2026-06-02",
      consecutiveDaysOff: 3,
      leaveDaysUsed: 0,
      holidays: [expect.objectContaining({ date: "2026-06-02" })],
    }));
    expect(() => optimizeItalianBridges({
      year: 2027,
      leaveDayBudget: 1,
      workweek: ["MON", "TUE", "WED", "THU", "FRI"],
    })).toThrowError(expect.objectContaining<Partial<BridgeOptimizerError>>({ code: "UNSUPPORTED_HOLIDAY_YEAR" }));
  });

  it("reads an anonymized ordinary FatturaPA invoice with pinned schema provenance", async () => {
    const xml = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"), "utf8");
    const result = readFatturaPaXml(xml);
    expect(result).toMatchObject({
      family: "ordinary",
      transmissionFormat: "FPR12",
      namespace: "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2",
      xsdVersion: "1.2.3",
      technicalSpecificationVersion: "1.4",
      externalEntityResolution: "disabled",
      supplier: { name: "Fornitore Demo", vatId: "IT00000000000", taxCode: "AAAAAAAAAAAAAAAA" },
      customer: { name: "Cliente Demo", taxCode: "BBBBBBBBBBBBBBBB" },
      fieldErrors: [],
    });
    expect(result.bodies[0]).toMatchObject({
      documentType: "TD01",
      currency: "EUR",
      date: "2026-10-06",
      number: "DEMO-1",
      documentTotal: "122.00",
    });
    expect(result.bodies[0]!.lines[0]).toMatchObject({ description: "Consulenza & supporto", lineTotal: "100.00", vatRatePercent: "22.00" });
    expect(result.bodies[0]!.vatSummaries[0]).toEqual({ taxableAmount: "100.00", taxAmount: "22.00", vatRatePercent: "22.00", vatNature: null });
  });

  it("reads the pinned simplified FatturaPA identity without treating it as the ordinary schema", async () => {
    const xml = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-simplified-anonymized.xml"), "utf8");
    const result = readFatturaPaXml(xml);
    expect(result).toMatchObject({
      family: "simplified",
      transmissionFormat: "FSM10",
      xsdVersion: "1.0.2",
      supplier: { name: "Fornitore Semplificato", vatId: "IT00000000000" },
      customer: { name: "Cliente Semplificato", taxCode: "CCCCCCCCCCCCCCCC" },
      fieldErrors: [],
    });
    expect(result.bodies[0]!.lines[0]).toMatchObject({ description: "Servizio demo", lineTotal: "50.00", vatAmount: "11.00", vatRatePercent: "22.00" });
  });

  it("isolates malformed mapped fields while preserving other readable invoice fields", async () => {
    const xml = (await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"), "utf8"))
      .replace("<Data>2026-10-06</Data>", "<Data>2026-02-30</Data>")
      .replace("<PrezzoTotale>100.00</PrezzoTotale>", "<PrezzoTotale>oops</PrezzoTotale>");
    const result = readFatturaPaXml(xml);
    expect(result.bodies[0]).toMatchObject({ number: "DEMO-1", date: null });
    expect(result.bodies[0]!.lines[0]).toMatchObject({ description: "Consulenza & supporto", lineTotal: null });
    expect(result.fieldErrors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INVALID_DATE", value: "2026-02-30" }),
      expect.objectContaining({ code: "INVALID_DECIMAL", value: "oops" }),
    ]));
  });

  it("refuses DTD/entity resolution, unknown namespaces and root/format mismatches", async () => {
    const ordinary = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"), "utf8");
    const hostile = ordinary.replace(
      "<p:FatturaElettronica",
      '<!DOCTYPE invoice [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<p:FatturaElettronica',
    );
    expect(() => readFatturaPaXml(hostile)).toThrow(/DTD|ENTITY|external entit/iu);
    expect(() => readFatturaPaXml(ordinary.replace("/fatture/v1.2", "/fatture/v9.9"))).toThrowError(
      expect.objectContaining<Partial<FatturaPaReaderError>>({ code: "FATTURAPA_NAMESPACE_UNSUPPORTED" }),
    );
    expect(() => readFatturaPaXml(ordinary.replace('versione="FPR12"', 'versione="FPA12"'))).toThrowError(
      expect.objectContaining<Partial<FatturaPaReaderError>>({ code: "FATTURAPA_VERSION_MISMATCH" }),
    );
  });
});
