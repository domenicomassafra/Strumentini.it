import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  ResultV2InventoryEntry,
  ResultV2MigrationOwner,
  ResultV2RendererSeam,
} from "../../src/catalog/projections";
import type { ToolSummary } from "../../src/catalog/manifest";

export interface ResultV2MigrationTicket {
  readonly id: number;
  readonly title: string;
  readonly path: string;
}

export const RESULT_V2_MIGRATION_TICKETS = {
  videoInspector: {
    id: 232,
    title: "Video inspector and target-size calculator",
    path: ".scratch/strumentini-expansion-20261005/issues/232-video-inspector-and-target-size-calculator.md",
  },
  businessMathShared: {
    id: 88,
    title: "Migrate BusinessMathTool renderer to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/88-migrate-businessmathtool-renderer-to-result-v2.md",
  },
  dateTimeShared: {
    id: 89,
    title: "Migrate date-time shared renderers to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/89-migrate-date-time-shared-renderers-to-result-v2.md",
  },
  calculatorMarketingBespoke: {
    id: 90,
    title: "Migrate calculator and marketing bespoke results to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/90-migrate-calculator-and-marketing-bespoke-results-to-result-v2.md",
  },
  developerWeb: {
    id: 91,
    title: "Migrate DeveloperWebTool renderer to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/91-migrate-developerwebtool-renderer-to-result-v2.md",
  },
  textWritingLists: {
    id: 92,
    title: "Migrate TextWriting and list renderers to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/92-migrate-textwriting-and-list-renderers-to-result-v2.md",
  },
  researchReference: {
    id: 93,
    title: "Migrate research and reference renderers to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/93-migrate-research-and-reference-renderers-to-result-v2.md",
  },
  tableWorkbench: {
    id: 94,
    title: "Migrate TableWorkbench shared path to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/94-migrate-tableworkbench-shared-path-to-result-v2.md",
  },
  bespokeCsvData: {
    id: 95,
    title: "Migrate bespoke CSV and data renderers to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/95-migrate-bespoke-csv-and-data-renderers-to-result-v2.md",
  },
  filePrivacyShared: {
    id: 96,
    title: "Migrate file privacy shared renderers to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/96-migrate-file-privacy-shared-renderers-to-result-v2.md",
  },
  image: {
    id: 97,
    title: "Migrate image shared renderers to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/97-migrate-image-shared-renderers-to-result-v2.md",
  },
  pdfDocument: {
    id: 98,
    title: "Migrate PdfTool and document renderers to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/98-migrate-pdftool-and-document-renderers-to-result-v2.md",
  },
  urlMarketingQrBespoke: {
    id: 99,
    title: "Migrate URL marketing QR and bespoke results to Result v2",
    path: ".scratch/strumentini-expansion-20261005/issues/99-migrate-url-marketing-qr-and-bespoke-results-to-result-v2.md",
  },
} as const satisfies Readonly<Record<string, ResultV2MigrationTicket>>;

export type ResultV2MigrationTicketKey = keyof typeof RESULT_V2_MIGRATION_TICKETS;

interface OwnerCandidate {
  readonly summary: ToolSummary;
  readonly seam: ResultV2RendererSeam;
}

interface MigrationOwnerRule {
  readonly ticket: ResultV2MigrationTicket;
  readonly matches: (candidate: OwnerCandidate) => boolean;
}

const TICKET_02_ENGINES = new Set(["business-math", "date-time", "marketing-math", "client-time-math", "campaign-url"]);
const TICKET_92_ENGINES = new Set(["text-writing", "text-list", "text-markup-conversion"]);
const TICKET_93_ENGINES = new Set(["research-knowledge", "research-reference"]);
const TICKET_97_ENGINES = new Set(["image", "image-visual"]);
const TICKET_99_ENGINES = new Set(["url-marketing", "qr-local", "file-hash"]);

export const RESULT_V2_MIGRATION_OWNER_RULES: readonly MigrationOwnerRule[] = [
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.businessMathShared,
    matches: ({ seam }) => seam.component === "BusinessMathTool",
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.dateTimeShared,
    matches: ({ seam }) => seam.component === "DateTimeOperation",
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.calculatorMarketingBespoke,
    matches: ({ summary, seam }) => (TICKET_02_ENGINES.has(summary.engine)
      && seam.component !== "BusinessMathTool"
      && seam.component !== "DateTimeOperation")
      || summary.engine === "browser-audio"
      || summary.engine === "barcode-linear-v1"
      || summary.engine === "design-css",
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.developerWeb,
    matches: ({ summary }) => summary.engine === "developer-web" || summary.engine === "browser-diagnostics",
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.textWritingLists,
    matches: ({ summary }) => TICKET_92_ENGINES.has(summary.engine),
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.researchReference,
    matches: ({ summary }) => TICKET_93_ENGINES.has(summary.engine),
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.tableWorkbench,
    matches: ({ summary }) => summary.engine === "table-operations",
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.bespokeCsvData,
    matches: ({ summary }) => summary.engine === "table-csv",
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.filePrivacyShared,
    matches: ({ summary }) => summary.engine === "file-privacy",
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.image,
    matches: ({ summary }) => TICKET_97_ENGINES.has(summary.engine),
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.pdfDocument,
    matches: ({ summary }) => summary.engine === "pdf" || (summary.id === "ooxml-media-compression" && summary.engine === "ooxml"),
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.urlMarketingQrBespoke,
    matches: ({ summary }) => TICKET_99_ENGINES.has(summary.engine),
  },
  {
    ticket: RESULT_V2_MIGRATION_TICKETS.videoInspector,
    matches: ({ summary, seam }) => summary.id === "video-inspector"
      && summary.engine === "video" && seam.component === "VideoInspectorTool",
  },
] as const;

export async function assertResultV2MigrationTicketsExist(
  root: string,
  tickets: readonly ResultV2MigrationTicket[] = Object.values(RESULT_V2_MIGRATION_TICKETS),
): Promise<void> {
  const ids = new Set<number>();
  const paths = new Set<string>();
  for (const ticket of tickets) {
    if (ids.has(ticket.id)) throw new Error(`Result v2 migration ledger: duplicate ticket id ${ticket.id}`);
    if (paths.has(ticket.path)) throw new Error(`Result v2 migration ledger: duplicate ticket path ${ticket.path}`);
    ids.add(ticket.id);
    paths.add(ticket.path);
    const source = await readFile(resolve(root, ticket.path), "utf8").catch(() => {
      throw new Error(`Result v2 migration ledger: migration ticket does not exist: ${ticket.path}`);
    });
    if (!source.startsWith(`# ${ticket.id} — ${ticket.title}\n`)) {
      throw new Error(`Result v2 migration ledger: migration ticket identity changed: ${ticket.path}`);
    }
  }
}

export function assignResultV2MigrationOwners(
  summaries: readonly ToolSummary[],
  rendererSeams: readonly ResultV2RendererSeam[],
  rules: readonly MigrationOwnerRule[] = RESULT_V2_MIGRATION_OWNER_RULES,
): readonly ResultV2MigrationOwner[] {
  const seamsById = new Map(rendererSeams.map((seam) => [seam.toolId, seam] as const));
  const owners: ResultV2MigrationOwner[] = [];
  for (const summary of summaries) {
    const seam = seamsById.get(summary.id);
    if (seam === undefined) throw new Error(`Result v2 migration ledger: missing renderer seam for ${summary.id}`);
    const matches = rules.filter((rule) => rule.matches({ summary, seam }));
    if (matches.length === 0) throw new Error(`Result v2 migration ledger: orphan tool without migration owner: ${summary.id}`);
    if (matches.length > 1) {
      throw new Error(`Result v2 migration ledger: duplicate migration ownership for ${summary.id}: ${matches.map(({ ticket }) => ticket.id).join(", ")}`);
    }
    const owner = matches[0];
    if (owner === undefined) throw new Error(`Result v2 migration ledger: owner resolution failed for ${summary.id}`);
    owners.push({ toolId: summary.id, owner: owner.ticket.path });
  }
  return owners.toSorted((left, right) => left.toolId.localeCompare(right.toolId, "it-IT"));
}

export function assertResultV2MigrationLedgerComplete(entries: readonly ResultV2InventoryEntry[]): void {
  const missing = entries.filter(({ migrationOwner }) => migrationOwner === null).map(({ toolId }) => toolId);
  if (missing.length > 0) throw new Error(`Result v2 migration ledger: missing migration owner for ${missing.join(", ")}`);
  const knownPaths = new Set<string>(Object.values(RESULT_V2_MIGRATION_TICKETS).map(({ path }) => path));
  const staleOwners = entries.filter(({ migrationOwner }) => migrationOwner !== null && !knownPaths.has(migrationOwner));
  if (staleOwners.length > 0) {
    throw new Error(`Result v2 migration ledger: unknown migration owner path for ${staleOwners.map(({ toolId }) => toolId).join(", ")}`);
  }
}
