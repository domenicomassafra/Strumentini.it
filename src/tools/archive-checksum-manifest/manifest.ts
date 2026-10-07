import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "archive-checksum-manifest",
  route: "/tools/archive-checksum-manifest",
  name: "Archive Checksum Manifest",
  summary: "Hash a ZIP or selected files and emit a portable checksum manifest.",
  aliases: ["archive hash manifest", "zip checksum manifest"],
  jobs: ["create an archive checksum manifest"],
  category: "files",
  inputTypes: ["file", "zip"],
  implementation: "../tools/archive-checksum-manifest/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "retry", "reset", "provenance"] },
  handoff: { emits: [{ type: "structured", format: "sha256-manifest", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-173", fixtureFamilies: ["file-hash", "archive-checksum-manifest"] },
} as const satisfies ToolManifest;
