import type { ToolManifest } from "../../catalog/manifest";

export const fileHashManifest = {
  id: "file-hash",
  route: "/tools/file-hash",
  name: "File Hash / Checksum Verifier",
  summary: "Calculate a local SHA-256 digest and optionally verify an expected checksum without uploading the file.",
  aliases: ["checksum verifier", "sha256 file hash", "file checksum"],
  jobs: ["hash a file", "verify a checksum", "calculate sha256"],
  category: "files",
  inputTypes: ["file", "text"],
  implementation: "../tools/file-hash/module.ts",
  engine: "file-hash",
  runtime: {
    location: "LOCAL",
    network: "forbidden",
  },
  profileFields: [],
  gold: {
    maintenanceClass: "E",
    oracleEntryId: "cand-161",
    fixtureFamilies: ["sha2-known-answers", "file-hash"],
  },
} as const satisfies ToolManifest;

export default fileHashManifest;
