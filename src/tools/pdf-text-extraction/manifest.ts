import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfTextExtractionManifest = {
  id: "pdf-text-extraction",
  route: "/tools/pdf-text-extraction",
  name: "PDF Text Extraction",
  summary: "Extract selected PDF pages locally with explicit content-order/operator-lines modes, page separators, and bounded filter support.",
  aliases: ["extract pdf text", "pdf text reader", "get text from pdf"],
  jobs: ["extract text from selected pdf pages", "read pdf text locally", "copy text from pdf"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read"],
  implementation: "../tools/pdf-text-extraction/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-text-extraction"],
  handoff: { emits: [{ type: "text", format: "plain" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-128", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfTextExtractionManifest;
