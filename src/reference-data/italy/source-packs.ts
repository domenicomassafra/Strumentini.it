import type { ItalyOfficialSource, ItalyReferenceDomain } from "./types";

export type ItalySourcePackStatus = "READY" | "BLOCKED" | "REFUSED";

export type ItalySourceFreshnessMode = "annual-rollover" | "source-change";

export interface ItalySourceEvidenceSnapshot {
  readonly path: string;
  readonly sha256: `sha256:${string}`;
}

export interface ItalySourceFreshnessPolicy {
  readonly mode: ItalySourceFreshnessMode;
  readonly reviewTrigger: string;
}

export interface ItalyCandidateOfficialSource extends ItalyOfficialSource {
  /**
   * Candidate metadata is allowed only when the vendored repository evidence
   * identifies the authority/source but is still insufficient to support
   * normative values.
   */
  readonly sufficiency: "INSUFFICIENT";
  readonly limitation: string;
}

export interface ItalySourcePackDecision {
  readonly ticket: 115 | 116 | 117 | 118 | 119 | 120;
  readonly datasetId: string;
  readonly domain: ItalyReferenceDomain;
  readonly status: ItalySourcePackStatus;
  /** Version of the source-pack decision/evidence record, not a tax/schema version. */
  readonly decisionVersion: string;
  readonly checkedAt: string;
  readonly evidenceSnapshot: ItalySourceEvidenceSnapshot;
  readonly freshness: ItalySourceFreshnessPolicy;
  /**
   * Sources that are sufficient to support normative values. BLOCKED/REFUSED
   * decisions may legitimately have none.
   */
  readonly officialSources: readonly ItalyOfficialSource[];
  /**
   * Official metadata already present in the repo but not specific enough to
   * support rates/thresholds/schema claims.
   */
  readonly candidateOfficialSources?: readonly ItalyCandidateOfficialSource[];
  readonly reason: string;
}

const CHECKED_AT = "2026-10-06";

export const ITALY_SOURCE_PACK_DECISIONS = Object.freeze([
  {
    ticket: 115,
    datasetId: "italy-administrative-geography",
    domain: "administrative",
    status: "BLOCKED",
    decisionVersion: "115-evidence-2026-10-07.3",
    checkedAt: "2026-10-07",
    evidenceSnapshot: {
      path: "quality/reference-data/italy/115-administrative-geography-evidence.json",
      sha256: "sha256:a6d1bdda49f646f3f1d819e81e6aee396585c81fc6013f66baae4ff37c01c65e",
    },
    freshness: {
      mode: "source-change",
      reviewTrigger: "Re-evaluate when authoritative bulk coverage closes the remaining COD_CATASTO=ND suppressed-municipality gaps and the pre-1990/uncoded foreign-state gaps, or when a complete Agenzia Entrate historical export becomes reproducibly available.",
    },
    officialSources: [],
    candidateOfficialSources: [
      {
        type: "official-authority",
        authority: "ISTAT",
        title: "Elenco dei comuni italiani - aggiornato al 21 febbraio 2026",
        url: "https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.xlsx",
        sufficiency: "INSUFFICIENT",
        limitation: "The exact current workbook is pinned and covers current municipalities, but ticket 115 also requires complete historical/suppressed municipality and foreign-state four-character code coverage.",
      },
      {
        type: "official-authority",
        authority: "ISTAT / SITUAS",
        title: "Elenco comuni soppressi e non ricostituiti (report 128)",
        url: "https://situas-servizi.istat.it/publish/reportspooljson?pfun=128&pdata=17/03/1861",
        sufficiency: "INSUFFICIENT",
        limitation: "The official bulk exposes Agenzia-sourced COD_CATASTO for suppressed municipalities from 1861, but 18 rows spanning 16 distinct municipality identities are explicitly ND.",
      },
      {
        type: "official-authority",
        authority: "ISTAT / SITUAS",
        title: "Storico Paesi esteri (report 469)",
        url: "https://situas-servizi.istat.it/publish/reportspooljson?pfun=469&pdata=01/01/1990",
        sufficiency: "INSUFFICIENT",
        limitation: "The official bulk exposes Agenzia COD_AT, but its declared historical scope begins in 1990 and some historical rows remain uncoded.",
      },
      {
        type: "official-authority",
        authority: "Agenzia delle Entrate",
        title: "Archivio Comuni e Stati Esteri (ARCOM)",
        url: "https://arcom.agenziaentrate.gov.it/CitizenArCom/",
        sufficiency: "INSUFFICIENT",
        limitation: "ARCOM provides authoritative point queries, including suppressed entities, but no reproducible complete historical/suppressed bulk export was identified to close the remaining official code gaps.",
      },
    ],
    reason: "Official SITUAS bulk coverage now includes Agenzia-sourced COD_CATASTO for suppressed municipalities and COD_AT for foreign states, but 16 distinct suppressed municipalities remain COD_CATASTO=ND, the foreign-state history starts only in 1990, and some historical foreign rows are uncoded; ticket 115 therefore remains fail-closed BLOCKED.",
  },
  {
    ticket: 116,
    datasetId: "italy-national-holidays",
    domain: "calendar",
    status: "READY",
    decisionVersion: "116-evidence-2026-10-06.2",
    checkedAt: CHECKED_AT,
    evidenceSnapshot: {
      path: "quality/reference-data/italy/116-public-holiday-evidence.json",
      sha256: "sha256:9a3121b891e6916e46c6d7dccc9852b8bbbc20597e8c1ad449ce34a9228390c8",
    },
    freshness: {
      mode: "annual-rollover",
      reviewTrigger: "Re-evaluate at each supported calendar-year rollover and whenever the governing holiday laws change; existing project-policy holiday fixtures remain separately classified.",
    },
    officialSources: [
      {
        type: "official-authority",
        authority: "Normattiva",
        title: "Legge 27 maggio 1949, n. 260 - articolo 2",
        url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1949-05-27;260~art2",
      },
      {
        type: "official-authority",
        authority: "Normattiva",
        title: "Legge 5 marzo 1977, n. 54",
        url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1977-03-05;54",
      },
      {
        type: "official-authority",
        authority: "Normattiva",
        title: "D.P.R. 28 dicembre 1985, n. 792",
        url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1985-12-28;792",
      },
      {
        type: "official-authority",
        authority: "Normattiva",
        title: "Legge 20 novembre 2000, n. 336",
        url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2000-11-20;336",
      },
      {
        type: "official-authority",
        authority: "Normattiva",
        title: "Legge 8 ottobre 2025, n. 151",
        url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2025-10-08;151",
      },
    ],
    reason: "Pinned official legal texts support the 2026 named national-holiday pack, including Easter Monday and the 4 October holiday effective from 2026, with historical/local exclusions explicit.",
  },
  {
    ticket: 117,
    datasetId: "italy-fiscal-annual",
    domain: "fiscal",
    status: "BLOCKED",
    decisionVersion: "117-evidence-2026-10-06.2",
    checkedAt: CHECKED_AT,
    evidenceSnapshot: {
      path: "quality/reference-data/italy/117-fiscal-annual-evidence.json",
      sha256: "sha256:c74a976222a220b7cd1aa1d4c9f4d1df6086327788b3b01ae6457969c78e4126",
    },
    freshness: {
      mode: "annual-rollover",
      reviewTrigger: "Re-evaluate for every tax year before IVA presets, IRPEF brackets, or forfettario coefficients for that year can become selectable.",
    },
    officialSources: [],
    candidateOfficialSources: [
      {
        type: "official-authority",
        authority: "Agenzia delle Entrate",
        title: "Redditi PF 2026 - Quadro RN",
        url: "https://infoprecompilata.agenziaentrate.gov.it/portale/quadro-rn-quadro-rv",
        sufficiency: "INSUFFICIENT",
        limitation: "The official 2026 declaration page states that Quadro RN determines IRPEF for tax year 2025, so it cannot be used as a tax-year-2026 annual snapshot.",
      },
      {
        type: "official-authority",
        authority: "Agenzia delle Entrate",
        title: "Redditi PF 2026 - Quadro LM",
        url: "https://infoprecompilata.agenziaentrate.gov.it/portale/web/guest/quadro-lm",
        sufficiency: "INSUFFICIENT",
        limitation: "The page documents the forfettario declaration workflow but does not pin the complete IVA/IRPEF/forfettario rule set for tax year 2026.",
      },
    ],
    reason: "No tax year has a complete publication-specific official artifact set for IVA, national IRPEF and forfettario; current Redditi PF 2026 material concerns tax year 2025 for IRPEF, so no 2026 values are promoted.",
  },
  {
    ticket: 118,
    datasetId: "inps-contributions-annual",
    domain: "social-security",
    status: "READY",
    decisionVersion: "118-evidence-2026-10-07.1",
    checkedAt: "2026-10-07",
    evidenceSnapshot: {
      path: "quality/reference-data/italy/118-inps-annual-evidence.json",
      sha256: "sha256:144c00d1377760268abcdf47e88f6680b422570d190f6c3ecee3547fb640ad73",
    },
    freshness: {
      mode: "annual-rollover",
      reviewTrigger: "Re-evaluate each contribution year and whenever a governing INPS publication for a supported profile changes.",
    },
    officialSources: [
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
    reason: "Exact official 2026 INPS source bytes are pinned for Gestione Separata professionals, artigiani/commercianti and one bounded agricultural-worker employee profile; the employee employer share is explicitly derived from total minus worker rate and higher-base/general-employee paths remain fail-closed.",
  },
  {
    ticket: 119,
    datasetId: "fatturapa-technical-schema",
    domain: "technical",
    status: "READY",
    decisionVersion: "119-evidence-2026-10-06.2",
    checkedAt: CHECKED_AT,
    evidenceSnapshot: {
      path: "quality/reference-data/italy/119-fatturapa-evidence.json",
      sha256: "sha256:e3b3c658f26edf4880cd3d84d7805d221df127ebf84392c568703af310df5881",
    },
    freshness: {
      mode: "source-change",
      reviewTrigger: "Re-evaluate whenever the official FatturaPA format page publishes a new technical-specification version, namespace, transmission format or XSD version.",
    },
    officialSources: [
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
    reason: "Official FatturaPA v1.4 specification bytes and current ordinary/simplified XSDs are pinned with exact hashes, namespaces and schema versions.",
  },
  {
    ticket: 120,
    datasetId: "cap-comune",
    domain: "administrative",
    status: "REFUSED",
    decisionVersion: "120-feasibility-2026-10-06.1",
    checkedAt: CHECKED_AT,
    evidenceSnapshot: {
      path: "quality/reference-data/italy/120-cap-comune-feasibility-evidence.json",
      sha256: "sha256:f3bc23cc32d01d1befd06964e4f2aefd660551ae57da56d19fedcffb7e2ebedb",
    },
    freshness: {
      mode: "source-change",
      reviewTrigger: "Reopen only when an authoritative nationwide CAP↔Comune source with explicit licence/redistribution terms, update/version semantics, and reproducible ambiguity coverage is vendored or supported by an approved repository fetch pipeline.",
    },
    officialSources: [],
    reason: "No admissible repository evidence proves a maintainable authoritative nationwide CAP↔Comune mapping; the route must stay refused rather than infer postal coverage or use opaque scraped data.",
  },
] satisfies readonly ItalySourcePackDecision[]);

export function listItalySourcePackDecisions(): readonly ItalySourcePackDecision[] {
  validateItalySourcePackDecisions(ITALY_SOURCE_PACK_DECISIONS);
  return ITALY_SOURCE_PACK_DECISIONS;
}

export function getItalySourcePackDecision(ticket: ItalySourcePackDecision["ticket"]): ItalySourcePackDecision {
  const decision = listItalySourcePackDecisions().find((entry) => entry.ticket === ticket);
  if (decision === undefined) throw new Error(`Unknown Italy source-pack ticket: ${ticket}`);
  return decision;
}

export function validateItalySourcePackDecisions(decisions: readonly ItalySourcePackDecision[]): void {
  const tickets = new Set<number>();
  const datasets = new Set<string>();
  for (const decision of decisions) {
    if (tickets.has(decision.ticket)) throw new Error(`Duplicate Italy source-pack ticket: ${decision.ticket}`);
    tickets.add(decision.ticket);
    if (datasets.has(decision.datasetId)) throw new Error(`Duplicate Italy source-pack dataset: ${decision.datasetId}`);
    datasets.add(decision.datasetId);
    assertIsoDate(decision.checkedAt, `ticket ${decision.ticket} checkedAt`);
    if (decision.decisionVersion.trim().length === 0) throw new Error(`Ticket ${decision.ticket} has an empty decisionVersion`);
    if (decision.reason.trim().length === 0) throw new Error(`Ticket ${decision.ticket} has an empty reason`);
    if (decision.freshness.reviewTrigger.trim().length === 0) throw new Error(`Ticket ${decision.ticket} has no freshness review trigger`);
    if (!/^quality\/reference-data\/italy\/[a-z0-9-]+\.json$/u.test(decision.evidenceSnapshot.path)) {
      throw new Error(`Ticket ${decision.ticket} evidence snapshot must live under quality/reference-data/italy`);
    }
    if (!/^sha256:[0-9a-f]{64}$/u.test(decision.evidenceSnapshot.sha256)) {
      throw new Error(`Ticket ${decision.ticket} evidence snapshot hash must be sha256:<64 lowercase hex>`);
    }
    for (const source of [...decision.officialSources, ...(decision.candidateOfficialSources ?? [])]) {
      if (source.type !== "official-authority") throw new Error(`Ticket ${decision.ticket} contains a non-official source`);
      if (source.authority.trim().length === 0 || source.title.trim().length === 0) {
        throw new Error(`Ticket ${decision.ticket} contains incomplete source identity`);
      }
      const url = new URL(source.url);
      if (url.protocol !== "https:") throw new Error(`Ticket ${decision.ticket} source URL must use HTTPS`);
    }
    if (decision.status === "READY" && decision.officialSources.length === 0) {
      throw new Error(`Ticket ${decision.ticket} cannot be READY without a sufficient official source`);
    }
    if (decision.status !== "READY" && decision.officialSources.length > 0) {
      throw new Error(`Ticket ${decision.ticket} has sufficient official sources but is still ${decision.status}`);
    }
  }
}

function assertIsoDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error(`${field} must be YYYY-MM-DD`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) {
    throw new Error(`${field} is not a valid calendar date`);
  }
}
