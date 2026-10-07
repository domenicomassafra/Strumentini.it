import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "checksum-verifier",
  route: "/tools/checksum-verifier",
  name: "Checksum Verifier",
  summary: "Compare local SHA-256 file digests with an expected checksum manifest.",
  aliases: ["verify checksums", "sha256 manifest verifier"],
  jobs: ["verify a checksum manifest"],
  category: "files",
  inputTypes: ["file", "text"],
  implementation: "../tools/checksum-verifier/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "validator", capabilities: ["copy", "retry", "reset", "provenance"] },
  handoff: { accepts: [{ type: "file", maxBytes: 209_715_200 }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-163", fixtureFamilies: ["file-hash"] },
} as const satisfies ToolManifest;
