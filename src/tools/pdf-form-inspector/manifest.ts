import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfFormInspectorManifest = {
  id: "pdf-form-inspector",
  route: "/tools/pdf-form-inspector",
  name: "Compila e salva moduli PDF",
  summary: "Compila campi AcroForm di PDF locali, scarica una copia ancora modificabile o appiattiscila su richiesta; ispeziona anche i campi.",
  aliases: ["compilare modulo pdf", "modificare campi pdf", "inspect pdf forms", "pdf form fields", "read pdf form data"],
  jobs: ["compilare e salvare campi PDF", "appiattire modulo PDF compilato", "inspect pdf form fields", "list pdf form values"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-form-inspector/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-form-inspector"],
  handoff: { emits: [{ type: "structured", format: "pdf-forms" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-135", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfFormInspectorManifest;
