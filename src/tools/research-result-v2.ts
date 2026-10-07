import type { ResultDeclaration } from "../catalog/manifest";

export const RESEARCH_RESULT_V2_IDS = [
  "bibtex-deduplicator",
  "bibtex-formatter",
  "citation-deduplicator",
  "citation-key-generator",
  "date-source-normalizer",
  "doi-isbn-normalizer",
  "doi-link-builder",
  "doi-normalizer",
  "domain-frequency-counter",
  "evidence-table-builder",
  "iban-validator",
  "isbn-validator-converter",
  "notes-deduplicator",
  "partita-iva-validator",
  "pdf-page-citation-helper",
  "quote-counter",
  "reading-list-deduplicator",
  "reference-list-sorter",
  "research-pack-manifest",
  "research-url-cleaner",
  "ris-bibtex-converter",
  "timeline-sorter",
  "vocabulary-frequency-analyzer",
] as const;

export type ResearchResultV2ToolId = (typeof RESEARCH_RESULT_V2_IDS)[number];

export interface ResearchResultV2Definition {
  readonly declaration: ResultDeclaration;
  readonly oracleEntryId: string;
  readonly engine: "research-knowledge" | "research-reference";
  readonly reuseField?: string;
}

const TEXT_ACTIONS = ["copy", "download", "reset", "provenance"] as const;
const TEXT_REUSE_ACTIONS = ["copy", "download", "reuse", "reset", "provenance"] as const;
const TABLE_ACTIONS = ["copy", "download", "reset", "provenance"] as const;
const TABLE_HANDOFF_ACTIONS = ["copy", "download", "handoff", "reset", "provenance"] as const;
const VALIDATOR_REUSE_ACTIONS = ["copy", "download", "reuse", "retry", "reset", "provenance"] as const;

const DEFINITIONS = {
  "bibtex-deduplicator": {
    declaration: { class: "text-code", capabilities: TEXT_REUSE_ACTIONS },
    oracleEntryId: "cand-186",
    engine: "research-knowledge",
    reuseField: "text",
  },
  "bibtex-formatter": {
    declaration: { class: "text-code", capabilities: TEXT_REUSE_ACTIONS },
    oracleEntryId: "cand-185",
    engine: "research-knowledge",
    reuseField: "text",
  },
  "citation-deduplicator": {
    declaration: { class: "table", capabilities: TABLE_HANDOFF_ACTIONS },
    oracleEntryId: "cand-184",
    engine: "research-knowledge",
  },
  "citation-key-generator": {
    declaration: { class: "table", capabilities: TABLE_HANDOFF_ACTIONS },
    oracleEntryId: "cand-188",
    engine: "research-knowledge",
  },
  "date-source-normalizer": {
    declaration: { class: "validator", capabilities: VALIDATOR_REUSE_ACTIONS },
    oracleEntryId: "cand-193",
    engine: "research-knowledge",
    reuseField: "value",
  },
  "doi-isbn-normalizer": {
    declaration: { class: "validator", capabilities: VALIDATOR_REUSE_ACTIONS },
    oracleEntryId: "cand-181",
    engine: "research-reference",
    reuseField: "value",
  },
  "doi-link-builder": {
    declaration: { class: "validator", capabilities: VALIDATOR_REUSE_ACTIONS },
    oracleEntryId: "cand-182",
    engine: "research-knowledge",
    reuseField: "value",
  },
  "doi-normalizer": {
    declaration: { class: "validator", capabilities: VALIDATOR_REUSE_ACTIONS },
    oracleEntryId: "cand-181",
    engine: "research-knowledge",
    reuseField: "value",
  },
  "domain-frequency-counter": {
    declaration: { class: "table", capabilities: TABLE_ACTIONS },
    oracleEntryId: "cand-195",
    engine: "research-knowledge",
  },
  "evidence-table-builder": {
    declaration: { class: "table", capabilities: TABLE_HANDOFF_ACTIONS },
    oracleEntryId: "cand-196",
    engine: "research-knowledge",
  },
  "iban-validator": {
    declaration: { class: "validator", capabilities: VALIDATOR_REUSE_ACTIONS },
    oracleEntryId: "cand-209",
    engine: "research-reference",
    reuseField: "value",
  },
  "isbn-validator-converter": {
    declaration: { class: "validator", capabilities: VALIDATOR_REUSE_ACTIONS },
    oracleEntryId: "cand-183",
    engine: "research-knowledge",
    reuseField: "value",
  },
  "notes-deduplicator": {
    declaration: { class: "text-code", capabilities: TEXT_REUSE_ACTIONS },
    oracleEntryId: "cand-197",
    engine: "research-knowledge",
    reuseField: "notes",
  },
  "partita-iva-validator": {
    declaration: { class: "validator", capabilities: VALIDATOR_REUSE_ACTIONS },
    oracleEntryId: "cand-208",
    engine: "research-reference",
    reuseField: "value",
  },
  "pdf-page-citation-helper": {
    declaration: { class: "text-code", capabilities: TEXT_ACTIONS },
    oracleEntryId: "cand-190",
    engine: "research-knowledge",
  },
  "quote-counter": {
    declaration: { class: "text-code", capabilities: TEXT_REUSE_ACTIONS },
    oracleEntryId: "cand-191",
    engine: "research-knowledge",
    reuseField: "text",
  },
  "reading-list-deduplicator": {
    declaration: { class: "table", capabilities: TABLE_HANDOFF_ACTIONS },
    oracleEntryId: "cand-199",
    engine: "research-knowledge",
  },
  "reference-list-sorter": {
    declaration: { class: "table", capabilities: TABLE_HANDOFF_ACTIONS },
    oracleEntryId: "cand-189",
    engine: "research-knowledge",
  },
  "research-pack-manifest": {
    declaration: { class: "text-code", capabilities: TEXT_ACTIONS },
    oracleEntryId: "cand-200",
    engine: "research-knowledge",
  },
  "research-url-cleaner": {
    declaration: { class: "validator", capabilities: VALIDATOR_REUSE_ACTIONS },
    oracleEntryId: "cand-194",
    engine: "research-knowledge",
    reuseField: "url",
  },
  "ris-bibtex-converter": {
    declaration: { class: "text-code", capabilities: TEXT_REUSE_ACTIONS },
    oracleEntryId: "cand-187",
    engine: "research-knowledge",
    reuseField: "text",
  },
  "timeline-sorter": {
    declaration: { class: "table", capabilities: TABLE_ACTIONS },
    oracleEntryId: "cand-192",
    engine: "research-knowledge",
  },
  "vocabulary-frequency-analyzer": {
    declaration: { class: "table", capabilities: TABLE_ACTIONS },
    oracleEntryId: "cand-198",
    engine: "research-knowledge",
  },
} as const satisfies Record<ResearchResultV2ToolId, ResearchResultV2Definition>;

export function researchResultV2Definition(toolId: ResearchResultV2ToolId): ResearchResultV2Definition {
  return DEFINITIONS[toolId];
}

export function researchResultV2Declaration(toolId: ResearchResultV2ToolId): ResultDeclaration {
  return DEFINITIONS[toolId].declaration;
}

export function isResearchResultV2ToolId(value: string): value is ResearchResultV2ToolId {
  return (RESEARCH_RESULT_V2_IDS as readonly string[]).includes(value);
}
