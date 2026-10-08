import type { ToolManifest } from "../../catalog/manifest";

export const pdfPageNumbersManifest = {
  id: "pdf-page-numbers",
  route: "/tools/pdf-page-numbers",
  name: "PDF Page Numbers",
  summary: "Add page numbers locally as separate PDF content streams, with strict ranges, start offset, font, size and placement preview.",
  aliases: ["add pdf page numbers", "number pdf pages", "insert page number on pdf"],
  jobs: ["add page numbers to selected pdf pages", "number pdf with margins and offset", "position printed page numbers"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-page-numbers/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "pdf", capabilities: ["download", "reset", "retry"] },
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-261", fixtureFamilies: ["pdf-gold", "pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfPageNumbersManifest;
