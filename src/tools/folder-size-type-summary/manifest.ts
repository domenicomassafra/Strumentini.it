import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "folder-size-type-summary",
  route: "/tools/folder-size-type-summary",
  name: "Folder Size / Type Summary",
  summary: "Summarize a bounded local folder selection by extension and declared type.",
  aliases: ["folder size summary", "file type summary"],
  jobs: ["summarize local folder sizes"],
  category: "files",
  inputTypes: ["file", "folder"],
  implementation: "../tools/folder-size-type-summary/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "folder-summary", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-166", fixtureFamilies: ["mime-file-signatures"] },
} as const satisfies ToolManifest;
