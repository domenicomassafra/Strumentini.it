import type { ToolManifest } from "../../catalog/manifest";

export const pdfMetadataInspectorManifest = {
  id: "pdf-metadata-inspector",
  route: "/tools/pdf-metadata-inspector",
  name: "PDF Metadata Inspector",
  summary: "Inspect PDF Info metadata, page geometry, encryption markers, and structure locally.",
  aliases: ["pdf metadata viewer", "inspect pdf info", "pdf properties"],
  jobs: ["inspect pdf metadata", "view pdf properties", "check pdf structure"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read"],
  implementation: "../tools/pdf-metadata-inspector/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "pdf-inspection" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-129", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfMetadataInspectorManifest;
