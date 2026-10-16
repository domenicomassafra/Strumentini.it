import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfPasswordCheckManifest = {
  id: "pdf-password-check-remove",
  route: "/tools/pdf-password-check-remove",
  name: "Proteggi, controlla e sblocca PDF",
  summary: "Proteggi PDF con password AES-256, verifica la cifratura o sblocca un file autorizzato. Elaborazione locale e download del risultato.",
  aliases: ["pdf password check", "remove pdf password", "pdf encryption check", "proteggi pdf con password"],
  jobs: ["protect PDF with an opening password", "check pdf encryption", "remove pdf password when permitted", "inspect pdf password protection"],
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
