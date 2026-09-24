import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "file-list-diff",
  route: "/tools/file-list-diff",
  name: "File List Diff",
  summary: "Compare two bounded local file selections by relative path, size, and optional SHA-256.",
  aliases: ["file list diff"],
  jobs: ["compare file selections", "find added removed and changed files"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/file-list-diff/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-178", fixtureFamilies: ["list-set-ops", "filename-sanitization"] },
} as const satisfies ToolManifest;

export default manifest;
