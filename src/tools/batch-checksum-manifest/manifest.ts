import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "batch-checksum-manifest",
  route: "/tools/batch-checksum-manifest",
  name: "Batch Checksum Manifest",
  summary: "Create a portable SHA-256 manifest for several local files.",
  aliases: ["batch checksums", "checksum manifest"],
  jobs: ["create a batch checksum manifest"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/batch-checksum-manifest/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "sha256-manifest", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-162", fixtureFamilies: ["file-hash"] },
} as const satisfies ToolManifest;
