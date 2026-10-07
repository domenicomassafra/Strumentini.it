import type { ToolManifest } from "../../catalog/manifest";
import { PDF_EXPANSION_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfMultiTextSearchManifest = {
  id: "pdf-multi-text-search",
  route: "/tools/pdf-multi-text-search",
  name: "Multi-PDF Text Search",
  summary: "Search text across multiple local PDFs with file/page/context provenance and isolated per-file failure states.",
  aliases: ["search multiple pdfs", "find text in pdf files", "multi pdf search"],
  jobs: ["search text across multiple pdf files", "find a phrase by pdf page", "review searchable and non-searchable pdfs together"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read"],
  implementation: "../tools/pdf-multi-text-search/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_EXPANSION_RESULT_DECLARATIONS["pdf-multi-text-search"],
  handoff: { emits: [{ type: "structured", format: "pdf-search-results", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-253", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfMultiTextSearchManifest;
