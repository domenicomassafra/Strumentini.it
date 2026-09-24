import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "zip-creator",
  route: "/tools/zip-creator",
  name: "ZIP Creator",
  summary: "Create a bounded store-method ZIP from selected local files.",
  aliases: ["make zip", "create zip archive"],
  jobs: ["create a local ZIP archive"],
  category: "files",
  inputTypes: ["file", "folder"],
  implementation: "../tools/zip-creator/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "file", format: "zip", maxBytes: 104_857_600 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-171", fixtureFamilies: ["zip-signatures"] },
} as const satisfies ToolManifest;
