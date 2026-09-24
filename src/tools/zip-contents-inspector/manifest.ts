import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "zip-contents-inspector",
  route: "/tools/zip-contents-inspector",
  name: "ZIP Contents Inspector",
  summary: "Read a ZIP central directory and inspect entry names, sizes, methods, and risk flags.",
  aliases: ["inspect zip", "zip listing", "zip slip check"],
  jobs: ["inspect ZIP contents"],
  category: "files",
  inputTypes: ["file", "zip"],
  implementation: "../tools/zip-contents-inspector/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "zip-index", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-170", fixtureFamilies: ["zip-signatures"] },
} as const satisfies ToolManifest;
