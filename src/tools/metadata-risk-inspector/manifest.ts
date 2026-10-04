import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "metadata-risk-inspector",
  route: "/tools/metadata-risk-inspector",
  name: "Metadata Risk Inspector",
  summary: "Inspect bounded metadata-like markers and filename risks before sharing.",
  aliases: ["metadata privacy check", "file metadata risk"],
  jobs: ["inspect metadata risk locally"],
  category: "files",
  inputTypes: ["file", "image", "pdf"],
  implementation: "../tools/metadata-risk-inspector/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "metadata-risk-report", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-174", fixtureFamilies: ["image-metadata", "metadata-risk-scan"] },
} as const satisfies ToolManifest;
