export const WORK_CONTEXT_IDS = [
  "client-services",
  "marketing-growth",
  "data-cleanup",
  "research-evidence",
  "file-asset-handoff",
] as const;

export type WorkContextId = (typeof WORK_CONTEXT_IDS)[number];

export interface WorkContextPack {
  readonly id: WorkContextId;
  readonly label: string;
  readonly description: string;
  readonly jobIds: readonly RecurringJobId[];
  readonly toolIds: readonly string[];
  readonly reasons: Readonly<Record<string, string>>;
}

export const RECURRING_JOB_IDS = [
  "clean-tables",
  "compare-text",
  "plan-dates",
  "build-links",
  "calculate-client-work",
  "prepare-handoffs",
  "research-citations",
  "inspect-files",
] as const;

export type RecurringJobId = (typeof RECURRING_JOB_IDS)[number];

export interface RecurringJob {
  readonly id: RecurringJobId;
  readonly label: string;
  readonly matchTerms: readonly string[];
}

export const RECURRING_JOBS: readonly RecurringJob[] = [
  { id: "clean-tables", label: "Pulire tabelle e CSV", matchTerms: ["csv", "tabella", "tabelle", "righe", "colonne", "foglio", "table", "rows", "columns", "spreadsheet"] },
  { id: "compare-text", label: "Confrontare testi e liste", matchTerms: ["testo", "lista", "liste", "confronto", "duplicati", "text", "list", "diff", "dedupe", "compare"] },
  { id: "plan-dates", label: "Pianificare date e fusi orari", matchTerms: ["data", "date", "giorno lavorativo", "business day", "fuso orario", "timezone", "calendario", "schedule", "scadenza", "deadline"] },
  { id: "build-links", label: "Creare o pulire URL", matchTerms: ["url", "campagna", "campaign", "utm", "tracciamento", "tracking", "link"] },
  { id: "calculate-client-work", label: "Calcolare tariffe e margini", matchTerms: ["tariffa", "rate", "margine", "margin", "ricarico", "markup", "valuta", "currency", "fattura", "invoice"] },
  { id: "prepare-handoffs", label: "Preparare consegne per i clienti", matchTerms: ["consegna", "handoff", "cliente", "client", "file", "manifest", "condivisione", "share"] },
  { id: "research-citations", label: "Preparare ricerca e citazioni", matchTerms: ["doi", "isbn", "citazione", "citation", "bibliografia", "bibliography", "ricerca", "research"] },
  { id: "inspect-files", label: "Ispezionare e verificare file", matchTerms: ["file", "hash", "checksum", "firma", "signature", "metadati", "metadata"] },
] as const;

const context = (
  id: WorkContextId,
  label: string,
  description: string,
  jobIds: readonly RecurringJobId[],
  toolIds: readonly string[],
  reasons: Readonly<Record<string, string>>,
): WorkContextPack => ({ id, label, description, jobIds, toolIds, reasons });

export const WORK_CONTEXT_PACKS: readonly WorkContextPack[] = [
  context(
    "client-services",
    "Consulenza e servizi ai clienti",
    "Date, sostenibilità economica del lavoro e controlli ripetibili prima della consegna.",
    ["plan-dates", "calculate-client-work", "compare-text", "prepare-handoffs"],
    [
      "business-day",
      "timezone-overlap",
      "rate-converter",
      "margin-markup",
      "list-compare",
      "text-diff",
      "file-hash",
      "csv-cleaner",
      "csv-dedupe",
      "csv-column-map",
    ],
    {
      "business-day": "Incluso nel contesto consulenza e servizi ai clienti.",
      "timezone-overlap": "Incluso nel contesto consulenza e servizi ai clienti.",
      "rate-converter": "Incluso nel contesto consulenza e servizi ai clienti.",
      "margin-markup": "Incluso nel contesto consulenza e servizi ai clienti.",
      "list-compare": "Incluso nel contesto consulenza e servizi ai clienti.",
      "text-diff": "Incluso nel contesto consulenza e servizi ai clienti.",
      "file-hash": "Incluso nel contesto consulenza e servizi ai clienti.",
      "csv-cleaner": "Incluso nel contesto consulenza e servizi ai clienti.",
      "csv-dedupe": "Incluso nel contesto consulenza e servizi ai clienti.",
      "csv-column-map": "Incluso nel contesto consulenza e servizi ai clienti.",
    },
  ),
  context(
    "marketing-growth",
    "Marketing e crescita",
    "Link di campagna, nomenclatura, pulizia dei report e controlli prima della consegna.",
    ["build-links", "clean-tables", "compare-text", "prepare-handoffs"],
    [
      "campaign-name",
      "tracking-cleaner",
      "utm-builder",
      "list-compare",
      "text-diff",
      "file-hash",
      "csv-cleaner",
      "csv-dedupe",
      "csv-column-map",
      "business-day",
    ],
    {
      "campaign-name": "Incluso nel contesto marketing e crescita.",
      "tracking-cleaner": "Incluso nel contesto marketing e crescita.",
      "utm-builder": "Incluso nel contesto marketing e crescita.",
      "list-compare": "Incluso nel contesto marketing e crescita.",
      "text-diff": "Incluso nel contesto marketing e crescita.",
      "file-hash": "Incluso nel contesto marketing e crescita.",
      "csv-cleaner": "Incluso nel contesto marketing e crescita.",
      "csv-dedupe": "Incluso nel contesto marketing e crescita.",
      "csv-column-map": "Incluso nel contesto marketing e crescita.",
      "business-day": "Incluso nel contesto marketing e crescita.",
    },
  ),
  context(
    "data-cleanup",
    "Pulizia dei dati",
    "Pulizia e confronto di tabelle e consegne dati ripetibili.",
    ["clean-tables", "compare-text", "build-links", "prepare-handoffs"],
    [
      "doi-isbn-normalizer",
      "list-compare",
      "text-diff",
      "file-hash",
      "csv-cleaner",
      "csv-dedupe",
      "campaign-name",
      "tracking-cleaner",
      "utm-builder",
      "rate-converter",
    ],
    {
      "doi-isbn-normalizer": "Incluso nel contesto pulizia dei dati.",
      "list-compare": "Incluso nel contesto pulizia dei dati.",
      "text-diff": "Incluso nel contesto pulizia dei dati.",
      "file-hash": "Incluso nel contesto pulizia dei dati.",
      "csv-cleaner": "Incluso nel contesto pulizia dei dati.",
      "csv-dedupe": "Incluso nel contesto pulizia dei dati.",
      "campaign-name": "Incluso nel contesto pulizia dei dati.",
      "tracking-cleaner": "Incluso nel contesto pulizia dei dati.",
      "utm-builder": "Incluso nel contesto pulizia dei dati.",
      "rate-converter": "Incluso nel contesto pulizia dei dati.",
    },
  ),
  context(
    "research-evidence",
    "Ricerca e fonti",
    "Pulizia delle citazioni, confronto testi, tabelle e consegne verificabili.",
    ["research-citations", "compare-text", "clean-tables", "prepare-handoffs"],
    [
      "doi-isbn-normalizer",
      "list-compare",
      "text-diff",
      "file-hash",
      "csv-cleaner",
      "csv-dedupe",
      "csv-column-map",
      "rate-converter",
      "timezone-overlap",
      "campaign-name",
    ],
    {
      "doi-isbn-normalizer": "Incluso nel contesto ricerca e fonti.",
      "list-compare": "Incluso nel contesto ricerca e fonti.",
      "text-diff": "Incluso nel contesto ricerca e fonti.",
      "file-hash": "Incluso nel contesto ricerca e fonti.",
      "csv-cleaner": "Incluso nel contesto ricerca e fonti.",
      "csv-dedupe": "Incluso nel contesto ricerca e fonti.",
      "csv-column-map": "Incluso nel contesto ricerca e fonti.",
      "rate-converter": "Incluso nel contesto ricerca e fonti.",
      "timezone-overlap": "Incluso nel contesto ricerca e fonti.",
      "campaign-name": "Incluso nel contesto ricerca e fonti.",
    },
  ),
  context(
    "file-asset-handoff",
    "Consegna di file e risorse",
    "Controlli locali sui file e dati strutturati da passare ad altre persone.",
    ["inspect-files", "prepare-handoffs", "clean-tables", "compare-text"],
    [
      "file-hash",
      "csv-cleaner",
      "csv-dedupe",
      "csv-column-map",
      "list-compare",
      "text-diff",
      "tracking-cleaner",
      "utm-builder",
      "business-day",
      "timezone-overlap",
    ],
    {
      "file-hash": "Incluso nel contesto consegna di file e risorse.",
      "csv-cleaner": "Incluso nel contesto consegna di file e risorse.",
      "csv-dedupe": "Incluso nel contesto consegna di file e risorse.",
      "csv-column-map": "Incluso nel contesto consegna di file e risorse.",
      "list-compare": "Incluso nel contesto consegna di file e risorse.",
      "text-diff": "Incluso nel contesto consegna di file e risorse.",
      "tracking-cleaner": "Incluso nel contesto consegna di file e risorse.",
      "utm-builder": "Incluso nel contesto consegna di file e risorse.",
      "business-day": "Incluso nel contesto consegna di file e risorse.",
      "timezone-overlap": "Incluso nel contesto consegna di file e risorse.",
    },
  ),
] as const;

export function getWorkContextPack(id: WorkContextId): WorkContextPack {
  const found = WORK_CONTEXT_PACKS.find((pack) => pack.id === id);
  if (found === undefined) throw new Error(`Contesto di lavoro sconosciuto: ${id}`);
  return found;
}

export function getRecurringJob(id: RecurringJobId): RecurringJob {
  const found = RECURRING_JOBS.find((job) => job.id === id);
  if (found === undefined) throw new Error(`Attività ricorrente sconosciuta: ${id}`);
  return found;
}
