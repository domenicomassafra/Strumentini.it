import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfPageReorderManifest = {
  id: "pdf-page-reorder",
  route: "/tools/pdf-page-reorder",
  name: "PDF Page Reorder",
  summary: "Reorder every page of a local PDF using an explicit one-based page order.",
  aliases: ["reorder pdf pages", "pdf page order", "rearrange pdf"],
  jobs: ["reorder pdf pages", "rearrange pdf pages", "change pdf page order"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-page-reorder/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-page-reorder"],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-123", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfPageReorderManifest;
