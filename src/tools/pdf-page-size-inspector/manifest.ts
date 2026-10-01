import type { ToolManifest } from "../../catalog/manifest";

export const pdfPageSizeInspectorManifest = {
  id: "pdf-page-size-inspector",
  route: "/tools/pdf-page-size-inspector",
  name: "PDF Page Size Inspector",
  summary: "Report bounded page dimensions and rotations from a local PDF page tree.",
  aliases: ["pdf page dimensions", "inspect pdf size", "pdf media box viewer"],
  jobs: ["inspect pdf page sizes", "check pdf dimensions", "list pdf page geometry"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read"],
  implementation: "../tools/pdf-page-size-inspector/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "pdf-pages" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-131", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfPageSizeInspectorManifest;
