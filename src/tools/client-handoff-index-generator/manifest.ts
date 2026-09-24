import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "client-handoff-index-generator",
  route: "/tools/client-handoff-index-generator",
  name: "Client Handoff Index Generator",
  summary: "Create a local handoff index with safe names, sizes, and optional SHA-256 digests.",
  aliases: ["client handoff index generator"],
  jobs: ["create a file handoff index", "prepare a portable handoff manifest"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/client-handoff-index-generator/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-177", fixtureFamilies: ["file-hash", "filename-sanitization"] },
} as const satisfies ToolManifest;

export default manifest;
