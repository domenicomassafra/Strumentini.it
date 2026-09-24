import type { ToolManifest } from "../../catalog/manifest";

export const pdfFormInspectorManifest = {
  id: "pdf-form-inspector",
  route: "/tools/pdf-form-inspector",
  name: "PDF Form Field Inspector",
  summary: "Inspect local AcroForm field names, types, values, and read-only flags without filling or submitting.",
  aliases: ["inspect pdf forms", "pdf form fields", "read pdf form data"],
  jobs: ["inspect pdf form fields", "list pdf form values", "check pdf form protection"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read"],
  implementation: "../tools/pdf-form-inspector/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "pdf-forms" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-135", fixtureFamilies: ["pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfFormInspectorManifest;
