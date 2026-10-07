import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "safe-share-checklist",
  route: "/tools/safe-share-checklist",
  name: "Safe Share Checklist",
  summary: "Run bounded local checks for empty files, secret-like markers, metadata markers, and temporary names.",
  aliases: ["safe share checklist"],
  jobs: ["run a pre-share checklist", "review files before sharing"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/safe-share-checklist/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "validator", capabilities: ["copy", "retry", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-176", fixtureFamilies: ["file-hash", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default manifest;
