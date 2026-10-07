import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfPageDeleteExtractManifest = {
  id: "pdf-page-delete-extract",
  route: "/tools/pdf-page-delete-extract",
  name: "PDF Page Delete / Extract",
  summary: "Delete or extract explicit one-based pages from a local PDF.",
  aliases: ["delete pdf pages", "extract pdf pages", "pdf page remover"],
  jobs: ["delete pdf pages", "extract selected pdf pages", "remove pages from pdf"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-page-delete-extract/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-page-delete-extract"],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-125", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfPageDeleteExtractManifest;
