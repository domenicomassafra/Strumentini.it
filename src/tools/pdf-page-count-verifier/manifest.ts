import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfPageCountVerifierManifest = {
  id: "pdf-page-count-verifier",
  route: "/tools/pdf-page-count-verifier",
  name: "PDF Page Count Verifier",
  summary: "Verify the declared and observed page count of a local PDF with a signature preflight.",
  aliases: ["pdf page counter", "count pdf pages", "verify pdf pages"],
  jobs: ["count pdf pages", "verify pdf page count", "check pdf page tree"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read"],
  implementation: "../tools/pdf-page-count-verifier/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-page-count-verifier"],
  handoff: { emits: [{ type: "structured", format: "pdf-pages" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-132", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfPageCountVerifierManifest;
