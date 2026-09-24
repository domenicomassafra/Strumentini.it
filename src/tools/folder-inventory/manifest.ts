import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "folder-inventory",
  route: "/tools/folder-inventory",
  name: "Folder Inventory",
  summary: "List bounded metadata for files selected from a local folder.",
  aliases: ["folder listing", "local folder inventory"],
  jobs: ["inventory a local folder selection"],
  category: "files",
  inputTypes: ["file", "folder"],
  implementation: "../tools/folder-inventory/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "file-inventory", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-165", fixtureFamilies: ["filename-sanitization"] },
} as const satisfies ToolManifest;
