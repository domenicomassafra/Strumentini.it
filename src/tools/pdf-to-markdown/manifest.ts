import type { ToolManifest } from "../../catalog/manifest";
import { PDF_EXPANSION_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfToMarkdownManifest = {
  id: "pdf-to-markdown",
  route: "/tools/pdf-to-markdown",
  name: "PDF to Markdown",
  summary: "Export page-scoped PDF text to Markdown with explicit page provenance and declared layout/style losses.",
  aliases: ["convert pdf to markdown", "pdf md export", "pdf text to markdown"],
  jobs: ["convert searchable pdf text to markdown", "export pdf pages with markdown provenance"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-to-markdown/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_EXPANSION_RESULT_DECLARATIONS["pdf-to-markdown"],
  handoff: { emits: [{ type: "text", format: "markdown", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-254", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfToMarkdownManifest;
