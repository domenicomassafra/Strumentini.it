import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfPasswordCheckManifest = {
  id: "pdf-password-check-remove",
  route: "/tools/pdf-password-check-remove",
  name: "Proteggi o sblocca PDF",
  summary: "Cifra PDF con AES-256 e sblocca file supportati solo con password valida. Tutto resta sul dispositivo.",
  aliases: ["pdf password check", "pdf encryption check", "password pdf", "proteggi pdf", "sblocca pdf"],
  jobs: ["check pdf encryption", "encrypt pdf", "decrypt pdf with supplied password"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-password-check-remove/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-password-check-remove"],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-133", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfPasswordCheckManifest;
