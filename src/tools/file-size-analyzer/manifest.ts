import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "file-size-analyzer",
  route: "/tools/file-size-analyzer",
  name: "File Size Analyzer",
  summary: "Explain observable image or ZIP size drivers locally without promising savings before a real transform runs.",
  aliases: ["why is my file large", "file size analyzer", "analyze large image", "analyze large zip"],
  jobs: ["inspect why a file is large", "inspect image size drivers", "inspect ZIP largest entries"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/file-size-analyzer/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "validator", capabilities: ["copy", "retry", "reset", "provenance"] },
  handoff: { emits: [{ type: "structured", format: "file-size-report", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-250", fixtureFamilies: ["image-metadata", "zip-signatures"] },
} as const satisfies ToolManifest;
