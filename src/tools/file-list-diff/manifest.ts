import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "file-list-diff",
  route: "/tools/file-list-diff",
  name: "File List Diff",
  summary: "File List Diff locally with bounded file selection and explicit privacy-safe output.",
  aliases: ["file list diff"],
  jobs: ["complete file list diff"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/file-list-diff/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-178", fixtureFamilies: ["list-set-ops", "filename-sanitization"] },
} as const satisfies ToolManifest;

export default manifest;
