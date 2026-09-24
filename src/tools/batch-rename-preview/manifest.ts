import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "batch-rename-preview",
  route: "/tools/batch-rename-preview",
  name: "Batch Rename Preview",
  summary: "Preview a deterministic rename pattern and collision-safe output names.",
  aliases: ["rename preview", "batch rename plan"],
  jobs: ["preview a batch rename"],
  category: "files",
  inputTypes: ["text", "file"],
  implementation: "../tools/batch-rename-preview/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "rename-plan", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-169", fixtureFamilies: ["filename-sanitization"] },
} as const satisfies ToolManifest;
