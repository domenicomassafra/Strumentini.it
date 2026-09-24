import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "folder-compare",
  route: "/tools/folder-compare",
  name: "Folder Compare",
  summary: "Folder Compare locally with bounded file selection and explicit privacy-safe output.",
  aliases: ["folder compare"],
  jobs: ["complete folder compare"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/folder-compare/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-179", fixtureFamilies: ["file-privacy", "folder-compare"] },
} as const satisfies ToolManifest;

export default manifest;
