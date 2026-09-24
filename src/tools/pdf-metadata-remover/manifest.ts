import type { ToolManifest } from "../../catalog/manifest";

export const pdfMetadataRemoverManifest = {
  id: "pdf-metadata-remover",
  route: "/tools/pdf-metadata-remover",
  name: "PDF Metadata Remover",
  summary: "Create a local PDF copy without the Info dictionary and embedded metadata streams it can address.",
  aliases: ["remove pdf metadata", "strip pdf properties", "pdf privacy scrub"],
  jobs: ["remove pdf metadata", "strip pdf info fields", "scrub pdf document properties"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-metadata-remover/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-130", fixtureFamilies: ["pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfMetadataRemoverManifest;
