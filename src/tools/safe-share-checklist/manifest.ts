import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "safe-share-checklist",
  route: "/tools/safe-share-checklist",
  name: "Safe Share Checklist",
  summary: "Safe Share Checklist locally with bounded file selection and explicit privacy-safe output.",
  aliases: ["safe share checklist"],
  jobs: ["complete safe share checklist"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/safe-share-checklist/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-safe-share-checklist", fixtureFamilies: ["file-privacy", "safe-share-checklist"] },
} as const satisfies ToolManifest;

export default manifest;
