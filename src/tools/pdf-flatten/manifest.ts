import type { ToolManifest } from "../../catalog/manifest";

export const pdfFlattenManifest = {
  id: "pdf-flatten",
  route: "/tools/pdf-flatten",
  name: "PDF Flatten Helper",
  summary: "Create a local page-only PDF copy by dropping supported interactive annotation and form hooks.",
  aliases: ["flatten pdf", "remove pdf annotations", "flatten pdf forms"],
  jobs: ["flatten a pdf", "remove pdf annotations", "make pdf pages non-interactive"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-flatten/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-134", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfFlattenManifest;
