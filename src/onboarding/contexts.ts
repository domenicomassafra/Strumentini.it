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
  { id: "clean-tables", label: "Clean tables and CSVs", matchTerms: ["csv", "table", "rows", "columns", "spreadsheet"] },
  { id: "compare-text", label: "Compare text and lists", matchTerms: ["text", "list", "diff", "dedupe", "compare"] },
  { id: "plan-dates", label: "Plan dates and timezones", matchTerms: ["date", "business day", "timezone", "schedule", "deadline"] },
  { id: "build-links", label: "Build or clean URLs", matchTerms: ["url", "campaign", "utm", "tracking", "link"] },
  { id: "calculate-client-work", label: "Calculate rates and margins", matchTerms: ["rate", "margin", "markup", "currency", "invoice"] },
  { id: "prepare-handoffs", label: "Prepare client handoffs", matchTerms: ["handoff", "client", "file", "manifest", "share"] },
  { id: "research-citations", label: "Prepare research and citations", matchTerms: ["doi", "isbn", "citation", "bibliography", "research"] },
  { id: "inspect-files", label: "Inspect and verify files", matchTerms: ["file", "hash", "checksum", "signature", "metadata"] },
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
    "Consulting / client services",
    "Dates, client economics, and repeatable delivery checks.",
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
      "business-day": "Part of the client-services work context.",
      "timezone-overlap": "Part of the client-services work context.",
      "rate-converter": "Part of the client-services work context.",
      "margin-markup": "Part of the client-services work context.",
      "list-compare": "Part of the client-services work context.",
      "text-diff": "Part of the client-services work context.",
      "file-hash": "Part of the client-services work context.",
      "csv-cleaner": "Part of the client-services work context.",
      "csv-dedupe": "Part of the client-services work context.",
      "csv-column-map": "Part of the client-services work context.",
    },
  ),
  context(
    "marketing-growth",
    "Marketing / growth",
    "Campaign links, naming, reporting cleanup, and handoff checks.",
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
      "campaign-name": "Part of the marketing-growth work context.",
      "tracking-cleaner": "Part of the marketing-growth work context.",
      "utm-builder": "Part of the marketing-growth work context.",
      "list-compare": "Part of the marketing-growth work context.",
      "text-diff": "Part of the marketing-growth work context.",
      "file-hash": "Part of the marketing-growth work context.",
      "csv-cleaner": "Part of the marketing-growth work context.",
      "csv-dedupe": "Part of the marketing-growth work context.",
      "csv-column-map": "Part of the marketing-growth work context.",
      "business-day": "Part of the marketing-growth work context.",
    },
  ),
  context(
    "data-cleanup",
    "Data cleanup",
    "Table cleanup, comparison, and repeatable data handoffs.",
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
      "doi-isbn-normalizer": "Part of the data-cleanup work context.",
      "list-compare": "Part of the data-cleanup work context.",
      "text-diff": "Part of the data-cleanup work context.",
      "file-hash": "Part of the data-cleanup work context.",
      "csv-cleaner": "Part of the data-cleanup work context.",
      "csv-dedupe": "Part of the data-cleanup work context.",
      "campaign-name": "Part of the data-cleanup work context.",
      "tracking-cleaner": "Part of the data-cleanup work context.",
      "utm-builder": "Part of the data-cleanup work context.",
      "rate-converter": "Part of the data-cleanup work context.",
    },
  ),
  context(
    "research-evidence",
    "Research / evidence",
    "Citation hygiene, text comparison, tables, and verifiable handoffs.",
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
      "doi-isbn-normalizer": "Part of the research-evidence work context.",
      "list-compare": "Part of the research-evidence work context.",
      "text-diff": "Part of the research-evidence work context.",
      "file-hash": "Part of the research-evidence work context.",
      "csv-cleaner": "Part of the research-evidence work context.",
      "csv-dedupe": "Part of the research-evidence work context.",
      "csv-column-map": "Part of the research-evidence work context.",
      "rate-converter": "Part of the research-evidence work context.",
      "timezone-overlap": "Part of the research-evidence work context.",
      "campaign-name": "Part of the research-evidence work context.",
    },
  ),
  context(
    "file-asset-handoff",
    "File & asset handoff",
    "Local file checks and structured data passed between people.",
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
      "file-hash": "Part of the file-asset-handoff work context.",
      "csv-cleaner": "Part of the file-asset-handoff work context.",
      "csv-dedupe": "Part of the file-asset-handoff work context.",
      "csv-column-map": "Part of the file-asset-handoff work context.",
      "list-compare": "Part of the file-asset-handoff work context.",
      "text-diff": "Part of the file-asset-handoff work context.",
      "tracking-cleaner": "Part of the file-asset-handoff work context.",
      "utm-builder": "Part of the file-asset-handoff work context.",
      "business-day": "Part of the file-asset-handoff work context.",
      "timezone-overlap": "Part of the file-asset-handoff work context.",
    },
  ),
] as const;

export function getWorkContextPack(id: WorkContextId): WorkContextPack {
  const found = WORK_CONTEXT_PACKS.find((pack) => pack.id === id);
  if (found === undefined) throw new Error(`Unknown work context: ${id}`);
  return found;
}

export function getRecurringJob(id: RecurringJobId): RecurringJob {
  const found = RECURRING_JOBS.find((job) => job.id === id);
  if (found === undefined) throw new Error(`Unknown recurring job: ${id}`);
  return found;
}
