import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "clean-zip-creator",
  route: "/tools/clean-zip-creator",
  name: "Clean ZIP Creator",
  summary: "Create a ZIP with sanitized relative paths and a local-only store method.",
  aliases: ["clean zip", "safe zip creator"],
  jobs: ["create a path-safe ZIP archive"],
  category: "files",
  inputTypes: ["file", "folder"],
  implementation: "../tools/clean-zip-creator/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "file", capabilities: ["download", "retry", "reset", "provenance", "before-after"] },
  handoff: { emits: [{ type: "file", format: "zip", maxBytes: 104_857_600 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-172", fixtureFamilies: ["zip-signatures"] },
} as const satisfies ToolManifest;
