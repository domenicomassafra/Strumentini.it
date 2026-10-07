import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "folder-compare",
  route: "/tools/folder-compare",
  name: "Folder Compare",
  summary: "Compare two bounded local folder selections by relative path, size, and optional SHA-256.",
  aliases: ["folder compare"],
  jobs: ["compare two folder selections", "find changed files by path and hash"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/folder-compare/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "batch", capabilities: ["copy", "retry", "reset", "provenance"] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-179", fixtureFamilies: ["list-set-ops", "filename-sanitization", "folder-compare-diff"] },
} as const satisfies ToolManifest;

export default manifest;
