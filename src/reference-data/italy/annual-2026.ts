import type { ItalyReferenceVersion } from "./types";

export type InpsAutonomousProfile = "artigiano" | "commerciante";
export type InpsContributionSeniority = "before-1996" | "from-1996";
export type InpsEmployeeProfile = "agricultural-worker-general";
export type GestioneSeparataProfessionalProfile =
  | "professional-no-other-mandatory-pension-coverage"
  | "professional-pensioner-or-other-mandatory-pension-coverage";

export interface InpsContributions2026Data {
  readonly employeeGeneralProfile: {
    readonly supported: false;
    readonly reason: string;
  };
  readonly employeeProfiles: Readonly<Record<InpsEmployeeProfile, {
    readonly label: string;
    readonly totalFpldRatePercent: number;
    readonly workerFpldRatePercent: number;
    readonly employerFpldRatePercent: number;
    readonly employerFpldRateDerivation: "total-minus-worker";
    readonly dailyMinimumReferenceEur: number;
    readonly partTimeMinimumHourlyEur: number;
    readonly additionalOnePercentThresholdEur: number;
    readonly sourceReportedAnnualBaseMaximumReferenceEur: number;
    readonly annualBaseMaximumUsage: "reference-only-not-applied-by-v1";
    readonly supportedBaseCeilingEur: number;
    readonly supportedAssumptions: readonly string[];
  }>>;
  readonly gestioneSeparataProfessionisti: {
    readonly incomeMinimumForFullYearCreditEur: number;
    readonly incomeMaximumEur: number;
    readonly profiles: Readonly<Record<GestioneSeparataProfessionalProfile, {
      readonly ratePercent: number;
      readonly componentsPercent?: Readonly<Record<string, number>>;
    }>>;
  };
  readonly artigianiCommercianti: {
    readonly incomeMinimumEur: number;
    readonly firstBandUpperEur: number;
    readonly ratesPercent: Readonly<Record<InpsAutonomousProfile, {
      readonly throughFirstBand: number;
      readonly aboveFirstBand: number;
    }>>;
    readonly annualMinimumContributionEur: Readonly<Record<InpsAutonomousProfile, number>>;
    readonly incomeMaximumEur: Readonly<Record<InpsContributionSeniority, number>>;
    readonly supportedAssumptions: readonly string[];
  };
}

export const INPS_CONTRIBUTIONS_2026: ItalyReferenceVersion<InpsContributions2026Data> = {
  metadata: {
    datasetId: "inps-contributions-annual",
    domain: "social-security",
    version: "2026.2",
    year: 2026,
    validity: { from: "2026-01-01", to: "2026-12-31" },
    checkedAt: "2026-10-07",
    snapshotHash: "sha256:144c00d1377760268abcdf47e88f6680b422570d190f6c3ecee3547fb640ad73",
    sources: [
      {
        type: "official-authority",
        authority: "INPS",
        title: "Circolare numero 8 del 03-02-2026 - Gestione Separata",
        url: "https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/02/Circolare_15153/Allegati/16573_Circolare-numero-8-del-03-02-2026.pdf",
        publishedAt: "2026-02-03",
      },
      {
        type: "official-authority",
        authority: "INPS",
        title: "Circolare numero 14 del 09-02-2026 - Artigiani e commercianti",
        url: "https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/02/Circolare_15162/Allegati/16561_Circolare-numero-14-del-09-02-2026.pdf",
        publishedAt: "2026-02-09",
      },
      {
        type: "official-authority",
        authority: "INPS",
        title: "Circolare numero 43 del 07-04-2026 - Lavoratori agricoli",
        url: "https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/04/Circolare_15228/Allegati/16697_Circolare-numero-43-del-07-04-2026.pdf",
        publishedAt: "2026-04-07",
      },
      {
        type: "official-authority",
        authority: "INPS",
        title: "Lavoratori dipendenti: limite minimo di retribuzione giornaliera 2026",
        url: "https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.lavoratori-dipendenti-limite-minimo-di-retribuzione-giornaliera-2026.html",
        publishedAt: "2026-02-02",
      },
    ],
  },
  data: {
    employeeGeneralProfile: {
      supported: false,
      reason: "The bounded 2026 employee implementation covers only the explicitly pinned agricultural-worker profile; a cross-sector general employee profile is not inferred.",
    },
    employeeProfiles: {
      "agricultural-worker-general": {
        label: "Operaio agricolo OTD/OTI - generalità dei datori di lavoro agricoli",
        totalFpldRatePercent: 30.5,
        workerFpldRatePercent: 8.84,
        employerFpldRatePercent: 21.66,
        employerFpldRateDerivation: "total-minus-worker",
        dailyMinimumReferenceEur: 58.13,
        partTimeMinimumHourlyEur: 8.94,
        additionalOnePercentThresholdEur: 56_224,
        sourceReportedAnnualBaseMaximumReferenceEur: 122_295,
        annualBaseMaximumUsage: "reference-only-not-applied-by-v1",
        supportedBaseCeilingEur: 56_224,
        supportedAssumptions: [
          "2026 agricultural worker OTD/OTI under the general agricultural-employer FPLD rate in INPS Circular 43/2026",
          "the employer 21.66% share is derived exactly as 30.50% total minus 8.84% worker share",
          "the v1 calculator is intentionally bounded to contribution bases at or below the source-reported 2026 additional-1% threshold",
          "the source-reported €122,295 annual base maximum is exposed as reference metadata only and is not applied by this v1",
          "industrial agricultural employers, special reductions, NASpI, INAIL and LOAgri are outside this v1 contribution calculation",
          "the caller supplies an already determined FPLD contribution base; daily-minimum and payroll-period base construction are outside this primitive",
          "part-time hourly remuneration, when supplied, must meet the pinned 2026 €8.94 minimum",
        ],
      },
    },
    gestioneSeparataProfessionisti: {
      incomeMinimumForFullYearCreditEur: 18_808,
      incomeMaximumEur: 122_295,
      profiles: {
        "professional-no-other-mandatory-pension-coverage": {
          ratePercent: 26.07,
          componentsPercent: { ivs: 25, additionalBenefits: 0.72, iscro: 0.35 },
        },
        "professional-pensioner-or-other-mandatory-pension-coverage": {
          ratePercent: 24,
        },
      },
    },
    artigianiCommercianti: {
      incomeMinimumEur: 18_808,
      firstBandUpperEur: 56_224,
      ratesPercent: {
        artigiano: { throughFirstBand: 24, aboveFirstBand: 25 },
        commerciante: { throughFirstBand: 24.48, aboveFirstBand: 25.48 },
      },
      annualMinimumContributionEur: {
        artigiano: 4_521.36,
        commerciante: 4_611.64,
      },
      incomeMaximumEur: {
        "before-1996": 93_707,
        "from-1996": 122_295,
      },
      supportedAssumptions: [
        "standard 2026 adult owner/adult collaborator rate path",
        "no age-based contribution reduction",
        "no forfettario contribution reduction",
        "no collaborator/special-category reduction not represented by the pinned source snapshot",
      ],
    },
  },
};

export interface ItalyNationalHoliday2026 {
  readonly date: string;
  readonly name: string;
  readonly kind: "fixed" | "movable";
}

export interface ItalyNationalHolidays2026Data {
  readonly holidays: readonly ItalyNationalHoliday2026[];
  readonly localOnly: readonly { readonly date: string; readonly name: string; readonly scope: string }[];
  readonly explicitlyNotNationwideNonWorking: readonly string[];
}

export const ITALY_NATIONAL_HOLIDAYS_2026: ItalyReferenceVersion<ItalyNationalHolidays2026Data> = {
  metadata: {
    datasetId: "italy-national-holidays",
    domain: "calendar",
    version: "2026.1",
    year: 2026,
    validity: { from: "2026-01-01", to: "2026-12-31" },
    checkedAt: "2026-10-06",
    snapshotHash: "sha256:9a3121b891e6916e46c6d7dccc9852b8bbbc20597e8c1ad449ce34a9228390c8",
    sources: [
      { type: "official-authority", authority: "Normattiva", title: "Legge 27 maggio 1949, n. 260 - articolo 2", url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1949-05-27;260~art2" },
      { type: "official-authority", authority: "Normattiva", title: "Legge 5 marzo 1977, n. 54", url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1977-03-05;54" },
      { type: "official-authority", authority: "Normattiva", title: "D.P.R. 28 dicembre 1985, n. 792", url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1985-12-28;792" },
      { type: "official-authority", authority: "Normattiva", title: "Legge 20 novembre 2000, n. 336", url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2000-11-20;336" },
      { type: "official-authority", authority: "Normattiva", title: "Legge 8 ottobre 2025, n. 151", url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2025-10-08;151" },
    ],
  },
  data: {
    holidays: [
      { date: "2026-01-01", name: "Capodanno", kind: "fixed" },
      { date: "2026-01-06", name: "Epifania", kind: "fixed" },
      { date: "2026-04-06", name: "Lunedì dopo Pasqua", kind: "movable" },
      { date: "2026-04-25", name: "Anniversario della Liberazione", kind: "fixed" },
      { date: "2026-05-01", name: "Festa del Lavoro", kind: "fixed" },
      { date: "2026-06-02", name: "Festa nazionale della Repubblica", kind: "fixed" },
      { date: "2026-08-15", name: "Assunzione", kind: "fixed" },
      { date: "2026-10-04", name: "Festa nazionale di San Francesco d'Assisi", kind: "fixed" },
      { date: "2026-11-01", name: "Tutti i Santi", kind: "fixed" },
      { date: "2026-12-08", name: "Immacolata Concezione", kind: "fixed" },
      { date: "2026-12-25", name: "Natale", kind: "fixed" },
      { date: "2026-12-26", name: "Santo Stefano", kind: "fixed" },
    ],
    localOnly: [{ date: "2026-06-29", name: "SS. Pietro e Paolo", scope: "Comune di Roma" }],
    explicitlyNotNationwideNonWorking: ["San Giuseppe", "Ascensione", "Corpus Domini", "SS. Pietro e Paolo (fuori dal Comune di Roma)", "4 novembre"],
  },
};

export interface FatturaPaSchemaIdentity {
  readonly family: "ordinary" | "simplified";
  readonly transmissionFormats: readonly string[];
  readonly namespace: string;
  readonly xsdVersion: string;
  readonly rootElement: string;
}

export interface FatturaPaTechnicalData {
  readonly technicalSpecificationVersion: string;
  readonly schemas: readonly FatturaPaSchemaIdentity[];
  readonly externalEntityResolution: "disabled";
}

export const FATTURAPA_TECHNICAL_CURRENT: ItalyReferenceVersion<FatturaPaTechnicalData> = {
  metadata: {
    datasetId: "fatturapa-technical-schema",
    domain: "technical",
    version: "1.4-schema-1.2.3-1.0.2",
    validity: { from: "2026-10-06", to: null },
    checkedAt: "2026-10-06",
    snapshotHash: "sha256:e3b3c658f26edf4880cd3d84d7805d221df127ebf84392c568703af310df5881",
    sources: [
      {
        type: "official-authority",
        authority: "FatturaPA / Agenzia delle Entrate",
        title: "Specifiche tecniche del formato FatturaPA - versione 1.4",
        url: "https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.4/Specifiche_tecniche_del_formato_FatturaPA_V1.4.pdf",
      },
      {
        type: "official-authority",
        authority: "FatturaPA / Agenzia delle Entrate",
        title: "Schema ordinario FatturaPA versione 1.2.3",
        url: "https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.4/Schema_VFPA12_V1.2.3.xsd",
      },
      {
        type: "official-authority",
        authority: "FatturaPA / Agenzia delle Entrate",
        title: "Schema semplificato FatturaPA versione 1.0.2",
        url: "https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.4/Schema_VFSM10v_1.0.2.xsd",
      },
    ],
  },
  data: {
    technicalSpecificationVersion: "1.4",
    schemas: [
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
    ],
    externalEntityResolution: "disabled",
  },
};
