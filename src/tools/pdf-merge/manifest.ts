import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfMergeManifest = {
  id: "pdf-merge",
  route: "/tools/pdf-merge",
  name: "PDF Merge",
  summary: "Combine bounded local PDF files into one document without uploading their pages.",
  aliases: ["merge pdf files", "combine pdf", "pdf concatenator"],
  jobs: ["merge pdf documents", "combine pdf pages", "join pdf files locally"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-merge/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-merge"],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-121", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfMergeManifest;
