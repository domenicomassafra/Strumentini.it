import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readOfficialInput } from "../scripts/lib/read-official-input-500.mjs";
import {
  getItalySourcePackDecision,
  listItalySourcePackDecisions,
  validateItalySourcePackDecisions,
  type ItalySourcePackDecision,
} from "../src/reference-data/italy";

const root = resolve(import.meta.dirname, "..");

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

describe("Italy source-pack decisions 115-120", () => {
  it("enumerates exactly the dependency-safe source tickets with versioned evidence and freshness policy", () => {
    const decisions = listItalySourcePackDecisions();
    expect(decisions.map(({ ticket }) => ticket)).toEqual([115, 116, 117, 118, 119, 120]);
    expect(decisions.every(({ decisionVersion, checkedAt, evidenceSnapshot, freshness }) =>
      decisionVersion.length > 0
      && /^2026-10-0[679]$/u.test(checkedAt)
      && evidenceSnapshot.sha256.startsWith("sha256:")
      && freshness.reviewTrigger.length > 20,
    )).toBe(true);
    expect(getItalySourcePackDecision(118).checkedAt).toBe("2026-10-07");
  });

  it("binds every decision identity to the exact checked-in evidence bytes", async () => {
    for (const decision of listItalySourcePackDecisions()) {
      const bytes = await readFile(resolve(root, decision.evidenceSnapshot.path));
      expect(sha256(bytes), `ticket ${decision.ticket}`).toBe(decision.evidenceSnapshot.sha256);
      const parsed = JSON.parse(bytes.toString("utf8")) as {
        ticket: number;
        datasetId: string;
        checkedAt: string;
        decision: string;
      };
      expect(parsed).toMatchObject({
        ticket: decision.ticket,
        datasetId: decision.datasetId,
        checkedAt: decision.checkedAt,
        decision: decision.status,
      });
    }
  });

  it("binds every pinned primary-source artifact to its exact checked-in bytes", async () => {
    for (const decision of listItalySourcePackDecisions()) {
      const evidence = JSON.parse(await readFile(resolve(root, decision.evidenceSnapshot.path), "utf8")) as {
        artifacts?: Array<{ path: string; sha256: string }>;
      };
      for (const artifact of evidence.artifacts ?? []) {
        const bytes = await readFile(resolve(root, artifact.path));
        expect(sha256(bytes), `${decision.ticket}:${artifact.path}`).toBe(artifact.sha256);
      }
    }
  });

  it("promotes only the source packs with complete pinned official evidence", () => {
    expect(Object.fromEntries(listItalySourcePackDecisions().map(({ ticket, status }) => [ticket, status]))).toEqual({
      115: "BLOCKED",
      116: "READY",
      117: "BLOCKED",
      118: "READY",
      119: "READY",
      120: "REFUSED",
    });
    for (const ticket of [116, 118, 119] as const) expect(getItalySourcePackDecision(ticket).officialSources.length).toBeGreaterThan(0);
    for (const ticket of [115, 117] as const) expect(getItalySourcePackDecision(ticket).officialSources).toEqual([]);
  });

  it("keeps administrative geography blocked after pinning only the official partial coverage", async () => {
    const decision = getItalySourcePackDecision(115);
    expect(decision.candidateOfficialSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ authority: "ISTAT", sufficiency: "INSUFFICIENT" }),
      expect.objectContaining({ authority: "Agenzia delle Entrate", sufficiency: "INSUFFICIENT" }),
    ]));

    const evidence = JSON.parse(await readFile(resolve(root, decision.evidenceSnapshot.path), "utf8")) as {
      artifacts: Array<{ sufficiency: string }>;
      frozenOfficialBulkArtifacts: Array<{ path: string; sha256: string; rows: number; rowsWithCode: number; rowsWithoutCode: number }>;
      normalizedLocalPack: { path: string; sha256: string; builder: string; currentMunicipalityRows: number };
      liveOfficialBulkChecks: Array<{
        title: string;
        sufficiency: string;
        observedRows?: number;
        missingCodeDistinctMunicipalities?: number;
        rowsWithCode?: number;
        rowsWithoutCode?: number;
        historicalRowsWithoutCode?: string[];
      }>;
      missingSuppressedMunicipalityCodes: Array<{ istatCode: string; name: string; year: number }>;
      observedCoverage: { historicalMunicipalities: string; foreignStates: string; belfiore: string };
    };
    expect(evidence.artifacts).toHaveLength(2);
    expect(evidence.artifacts.every(({ sufficiency }) => sufficiency === "PARTIAL")).toBe(true);
    expect(evidence.frozenOfficialBulkArtifacts.map(({ rows, rowsWithCode, rowsWithoutCode }) => ({ rows, rowsWithCode, rowsWithoutCode })))
      .toEqual([{ rows: 2637, rowsWithCode: 2619, rowsWithoutCode: 18 }, { rows: 262, rowsWithCode: 239, rowsWithoutCode: 23 }]);
    for (const { path, sha256: expectedSha } of evidence.frozenOfficialBulkArtifacts) {
      expect(sha256(readOfficialInput(root, path))).toBe(expectedSha);
    }
    expect(evidence.normalizedLocalPack).toMatchObject({
      builder: "scripts/build-italy-geography-115.mjs", currentMunicipalityRows: 7894,
    });
    expect(sha256(await readFile(resolve(root, evidence.normalizedLocalPack.path)))).toBe(evidence.normalizedLocalPack.sha256);
    expect(evidence.liveOfficialBulkChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Elenco comuni soppressi e non ricostituiti",
        sufficiency: "PARTIAL",
        observedRows: 2637,
        missingCodeDistinctMunicipalities: 16,
      }),
      expect.objectContaining({
        title: "Storico Paesi esteri",
        sufficiency: "PARTIAL",
        observedRows: 262,
        rowsWithCode: 239,
        rowsWithoutCode: 23,
        historicalRowsWithoutCode: ["Germania Ovest", "Yemen del Nord"],
      }),
    ]));
    expect(evidence.missingSuppressedMunicipalityCodes).toHaveLength(16);
    expect(evidence.missingSuppressedMunicipalityCodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ istatCode: "021090", name: "Senale/Unsere Liebe Frau im Walde", year: 1974 }),
      expect.objectContaining({ istatCode: "027810", name: "Oriago", year: 1868 }),
    ]));
    expect(evidence.observedCoverage.historicalMunicipalities).toMatch(/2,637 rows.*16 distinct.*COD_CATASTO=ND/iu);
    expect(evidence.observedCoverage.foreignStates).toMatch(/1 January 1990.*239.*23.*Germania Ovest.*Yemen del Nord/iu);
    expect(evidence.observedCoverage.belfiore).toMatch(/16 distinct suppressed municipalities.*COD_CATASTO=ND/iu);
  });

  it("pins the 2026 national holiday law set, movable Easter Monday and the new 4 October holiday", async () => {
    const decision = getItalySourcePackDecision(116);
    const evidence = JSON.parse(await readFile(resolve(root, decision.evidenceSnapshot.path), "utf8")) as {
      effectiveCoverage: { from: string; to: string };
      rules2026: {
        fixedNationalNonWorking: Array<{ monthDay: string; name: string }>;
        movable: Array<{ id: string; example2026: string }>;
        localOnly: Array<{ monthDay: string; scope: string }>;
        explicitlyNotNationwideNonWorking: Array<{ name: string }>;
      };
      excludedEvidence: Array<{ path: string; reason: string }>;
    };
    expect(evidence.effectiveCoverage).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(evidence.rules2026.fixedNationalNonWorking).toEqual(expect.arrayContaining([
      expect.objectContaining({ monthDay: "10-04", name: expect.stringMatching(/San Francesco/iu) }),
      expect.objectContaining({ monthDay: "06-02", name: expect.stringMatching(/Repubblica/iu) }),
    ]));
    expect(evidence.rules2026.movable).toEqual([
      expect.objectContaining({ id: "easter-monday", example2026: "2026-04-06" }),
    ]);
    expect(evidence.rules2026.localOnly).toEqual([
      expect.objectContaining({ monthDay: "06-29", scope: "Comune di Roma" }),
    ]);
    expect(evidence.rules2026.explicitlyNotNationwideNonWorking.map(({ name }) => name)).toContain("4 novembre");
    expect(evidence.excludedEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "quality/fixtures/holiday-calendar/vectors.json",
        reason: expect.stringMatching(/project-policy.*cannot be reclassified/iu),
      }),
    ]));

    const law260 = await readFile(resolve(root, "quality/reference-data/italy/artifacts/116-national-holidays/normattiva-legge-260-1949-art2-current.html"), "utf8");
    const law151 = await readFile(resolve(root, "quality/reference-data/italy/artifacts/116-national-holidays/normattiva-legge-151-2025.html"), "utf8");
    expect(law260).toMatch(/lunedi dopo Pasqua/iu);
    expect(law151).toMatch(/4 ottobre.*festa nazionale di San Francesco/isu);
  });

  it("keeps fiscal annual values blocked when 2026 declaration material does not establish a complete tax-year-2026 pack", async () => {
    const fiscal = getItalySourcePackDecision(117);
    expect(fiscal.status).toBe("BLOCKED");
    expect(fiscal.candidateOfficialSources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        authority: "Agenzia delle Entrate",
        title: "Redditi PF 2026 - Quadro RN",
        limitation: expect.stringMatching(/tax year 2025/iu),
      }),
    ]));
    const evidence = JSON.parse(await readFile(resolve(root, fiscal.evidenceSnapshot.path), "utf8")) as {
      requiredSubpacks: string[];
      publicationSpecificArtifacts: unknown[];
    };
    expect(evidence.requiredSubpacks).toEqual(["iva-rates", "irpef-national-brackets", "forfettario-coefficients-and-tax-rules"]);
    expect(evidence.publicationSpecificArtifacts).toEqual([]);
  });

  it("pins and parses the exact 2026 INPS sources for the supported contribution profiles", async () => {
    const inps = getItalySourcePackDecision(118);
    expect(inps.status).toBe("READY");
    expect(inps.officialSources.map(({ title }) => title)).toEqual([
      "Circolare numero 8 del 03-02-2026 - Gestione Separata",
      "Circolare numero 14 del 09-02-2026 - Artigiani e commercianti",
      "Circolare numero 43 del 07-04-2026 - Lavoratori agricoli",
      "Lavoratori dipendenti: limite minimo di retribuzione giornaliera 2026",
    ]);

    const evidence = JSON.parse(await readFile(resolve(root, inps.evidenceSnapshot.path), "utf8")) as {
      parsedFacts2026: {
        gestioneSeparataProfessionisti: {
          incomeMinimumEur: number;
          incomeMaximumEur: number;
          profiles: Array<{ id: string; ratePercent: number }>;
        };
        artigianiCommercianti: {
          incomeMinimumEur: number;
          firstBandUpperEur: number;
          ratesPercent: { artigiani: { throughFirstBand: number; aboveFirstBand: number }; commercianti: { throughFirstBand: number; aboveFirstBand: number } };
          annualMinimumContributionEur: { artigiani: number; commercianti: number };
          incomeMaximumEur: { withContributionSeniorityBefore1996: number; withoutContributionSeniorityAt1995YearEnd: number };
        };
        employeeProfiles: {
          "agricultural-worker-general": {
            totalFpldRatePercent: number;
            workerFpldRatePercent: number;
            employerFpldRatePercent: number;
            employerFpldRateDerivation: string;
            dailyMinimumReferenceEur: number;
            partTimeMinimumHourlyEur: number;
            additionalOnePercentThresholdEur: number;
            sourceReportedAnnualBaseMaximumReferenceEur: number;
            supportedBaseCeilingEur: number;
          };
        };
      };
      coverageLimits: string[];
    };
    expect(evidence.parsedFacts2026.gestioneSeparataProfessionisti).toMatchObject({
      incomeMinimumEur: 18808,
      incomeMaximumEur: 122295,
      profiles: expect.arrayContaining([
        expect.objectContaining({ id: "professional-no-other-mandatory-pension-coverage", ratePercent: 26.07 }),
        expect.objectContaining({ id: "professional-pensioner-or-other-mandatory-pension-coverage", ratePercent: 24 }),
      ]),
    });
    expect(evidence.parsedFacts2026.artigianiCommercianti).toMatchObject({
      incomeMinimumEur: 18808,
      firstBandUpperEur: 56224,
      ratesPercent: {
        artigiani: { throughFirstBand: 24, aboveFirstBand: 25 },
        commercianti: { throughFirstBand: 24.48, aboveFirstBand: 25.48 },
      },
      annualMinimumContributionEur: { artigiani: 4521.36, commercianti: 4611.64 },
      incomeMaximumEur: { withContributionSeniorityBefore1996: 93707, withoutContributionSeniorityAt1995YearEnd: 122295 },
    });
    expect(evidence.parsedFacts2026.employeeProfiles["agricultural-worker-general"]).toMatchObject({
      totalFpldRatePercent: 30.5,
      workerFpldRatePercent: 8.84,
      employerFpldRatePercent: 21.66,
      employerFpldRateDerivation: expect.stringMatching(/derived arithmetic/iu),
      dailyMinimumReferenceEur: 58.13,
      partTimeMinimumHourlyEur: 8.94,
      additionalOnePercentThresholdEur: 56224,
      sourceReportedAnnualBaseMaximumReferenceEur: 122295,
      supportedBaseCeilingEur: 56224,
    });
    expect(evidence.coverageLimits.join(" ")).toMatch(/other employee sectors.*unsupported/iu);

    const circ8 = await readFile(resolve(root, "quality/reference-data/italy/artifacts/118-inps-2026/inps-circolare-8-2026.pdf"));
    const circ14 = await readFile(resolve(root, "quality/reference-data/italy/artifacts/118-inps-2026/inps-circolare-14-2026.pdf"));
    const circ43 = await readFile(resolve(root, "quality/reference-data/italy/artifacts/129-inps-employee-2026/inps-circolare-43-2026.pdf"));
    const employeePage = await readFile(resolve(root, "quality/reference-data/italy/artifacts/129-inps-employee-2026/inps-lavoratori-dipendenti-2026.html"), "utf8");
    expect(circ8.subarray(0, 5).toString()).toBe("%PDF-");
    expect(circ14.subarray(0, 5).toString()).toBe("%PDF-");
    expect(circ43.subarray(0, 5).toString()).toBe("%PDF-");
    expect(circ8.toString("latin1")).toMatch(/122\.295,00/iu);
    expect(circ8.toString("latin1")).toMatch(/26,07/iu);
    expect(circ14.toString("latin1")).toMatch(/18\.808,00/iu);
    expect(circ14.toString("latin1")).toMatch(/24,48%/iu);
    expect(employeePage).toMatch(/58,13 euro/iu);
    expect(employeePage).toMatch(/122\.295 euro/iu);
    expect(employeePage).toMatch(/56\.224 euro annui/iu);
  });

  it("pins FatturaPA v1.4 with explicit ordinary and simplified XSD identities", async () => {
    const fatturapa = getItalySourcePackDecision(119);
    expect(fatturapa.status).toBe("READY");
    const evidence = JSON.parse(await readFile(resolve(root, fatturapa.evidenceSnapshot.path), "utf8")) as {
      technicalSpecificationVersion: string;
      supportedSchemas: Array<{ family: string; transmissionFormats: string[]; namespace: string; xsdVersion: string; rootElement: string }>;
      unknownVersionPolicy: string;
    };
    expect(evidence.technicalSpecificationVersion).toBe("1.4");
    expect(evidence.supportedSchemas).toEqual([
      {
        family: "ordinary",
        transmissionFormats: ["FPA12", "FPR12"],
        namespace: "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2",
        xsdVersion: "1.2.3",
        rootElement: "FatturaElettronica",
      },
      {
        family: "simplified",
        transmissionFormats: ["FSM10"],
        namespace: "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.0",
        xsdVersion: "1.0.2",
        rootElement: "FatturaElettronicaSemplificata",
      },
    ]);
    expect(evidence.unknownVersionPolicy).toMatch(/not explicitly listed.*unsupported/iu);

    const ordinary = await readFile(resolve(root, "quality/reference-data/italy/artifacts/119-fatturapa-v1.4/Schema_VFPA12_V1.2.3.xsd"), "utf8");
    const simplified = await readFile(resolve(root, "quality/reference-data/italy/artifacts/119-fatturapa-v1.4/Schema_VFSM10v_1.0.2.xsd"), "utf8");
    expect(ordinary).toMatch(/targetNamespace="http:\/\/ivaservizi\.agenziaentrate\.gov\.it\/docs\/xsd\/fatture\/v1\.2"/u);
    expect(ordinary).toMatch(/version="1\.2\.3"/u);
    expect(ordinary).toMatch(/<xs:element name="FatturaElettronica"/u);
    expect(simplified).toMatch(/targetNamespace="http:\/\/ivaservizi\.agenziaentrate\.gov\.it\/docs\/xsd\/fatture\/v1\.0"/u);
    expect(simplified).toMatch(/version="1\.0\.2"/u);
    expect(simplified).toMatch(/<xs:element name="FatturaElettronicaSemplificata"/u);
  });

  it("refuses CAP to Comune until authoritative nationwide licence/update/ambiguity evidence is proven", async () => {
    const cap = getItalySourcePackDecision(120);
    expect(cap.status).toBe("REFUSED");
    expect(cap.freshness.mode).toBe("source-change");
    expect(cap.freshness.reviewTrigger).toMatch(/authoritative nationwide CAP↔Comune.*licence.*update\/version.*ambiguity/iu);

    const evidence = JSON.parse(await readFile(resolve(root, cap.evidenceSnapshot.path), "utf8")) as {
      repositorySearch: { admissibleNationwideMappingFound: boolean };
      requirementsForImplement: string[];
      decision: string;
      reason: string;
    };
    expect(evidence.repositorySearch.admissibleNationwideMappingFound).toBe(false);
    expect(evidence.requirementsForImplement).toHaveLength(4);
    expect(evidence.decision).toBe("REFUSED");
    expect(evidence.reason).toMatch(/must not infer postal coverage.*municipality\/Belfiore codes|must not infer postal coverage.*Belfiore/iu);
  });

  it("fails validation when a READY pack has no sufficient official source", () => {
    const base = getItalySourcePackDecision(115);
    const invalid: ItalySourcePackDecision = {
      ...base,
      status: "READY",
      officialSources: [],
    };
    expect(() => validateItalySourcePackDecisions([invalid])).toThrow(/cannot be READY without a sufficient official source/u);
  });

  it("fails validation for duplicate ticket ownership or malformed evidence identity", () => {
    const base = getItalySourcePackDecision(115);
    expect(() => validateItalySourcePackDecisions([base, { ...base, datasetId: "other" }])).toThrow(/Duplicate Italy source-pack ticket/u);
    expect(() => validateItalySourcePackDecisions([{
      ...base,
      evidenceSnapshot: { ...base.evidenceSnapshot, sha256: "sha256:bad" },
    } as ItalySourcePackDecision])).toThrow(/64 lowercase hex/u);
  });
});
