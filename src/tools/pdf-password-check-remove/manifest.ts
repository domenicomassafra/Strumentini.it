import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfPasswordCheckManifest = {
  id: "pdf-password-check-remove",
  route: "/tools/pdf-password-check-remove",
  name: "Controlla cifratura PDF",
  summary: "Verifica localmente se un PDF è cifrato. Crea copie solo da PDF già non cifrati: i codec per protezione e sblocco sono stati ritirati.",
  aliases: ["pdf password check", "pdf encryption check"],
  jobs: ["check pdf encryption", "inspect pdf password protection", "copy unencrypted pdf"],
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
