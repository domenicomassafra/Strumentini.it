import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfCompareManifest = {
  id: "pdf-compare-lite",
  route: "/tools/pdf-compare-lite",
  name: "PDF Compare Lite",
  summary: "Compare two local PDFs by page count, geometry, rotation, and bounded extracted text.",
  aliases: ["compare pdf files", "pdf page diff", "compare pdf documents"],
  jobs: ["compare two pdfs", "diff pdf pages", "check pdf changes"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read"],
  implementation: "../tools/pdf-compare-lite/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-compare-lite"],
  handoff: { emits: [{ type: "structured", format: "pdf-compare" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-138", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfCompareManifest;
