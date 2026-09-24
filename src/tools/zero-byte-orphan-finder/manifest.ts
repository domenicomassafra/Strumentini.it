import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "zero-byte-orphan-finder",
  route: "/tools/zero-byte-orphan-finder",
  name: "Zero-byte / Orphan Finder",
  summary: "Find empty files and referenced paths absent from a bounded local file selection.",
  aliases: ["zero-byte / orphan finder"],
  jobs: ["find empty files", "find missing referenced paths"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/zero-byte-orphan-finder/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-180", fixtureFamilies: ["file-hash", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default manifest;
