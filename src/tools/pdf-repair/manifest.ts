import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfRepairManifest = {
  id: "pdf-repair",
  route: "/tools/pdf-repair",
  name: "PDF Repair (restricted)",
  summary: "Repair an isolated classic PDF startxref pointer after independently verifying visible pages and text.",
  aliases: ["repair damaged pdf", "restore pdf xref offset", "ripara pdf danneggiato"],
  jobs: ["repair one recoverable PDF pointer without changing original bytes"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write", "worker"],
  implementation: "../tools/pdf-repair/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-repair"],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-273", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfRepairManifest;
