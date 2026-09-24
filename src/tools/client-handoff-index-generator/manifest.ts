import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "client-handoff-index-generator",
  route: "/tools/client-handoff-index-generator",
  name: "Client Handoff Index Generator",
  summary: "Client Handoff Index Generator locally with bounded file selection and explicit privacy-safe output.",
  aliases: ["client handoff index generator"],
  jobs: ["complete client handoff index generator"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/client-handoff-index-generator/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-177", fixtureFamilies: ["file-privacy", "client-handoff-index-generator"] },
} as const satisfies ToolManifest;

export default manifest;
