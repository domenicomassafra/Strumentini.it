import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "zero-byte-orphan-finder",
  route: "/tools/zero-byte-orphan-finder",
  name: "Zero-byte / Orphan Finder",
  summary: "Zero-byte / Orphan Finder locally with bounded file selection and explicit privacy-safe output.",
  aliases: ["zero-byte / orphan finder"],
  jobs: ["complete zero-byte / orphan finder"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/zero-byte-orphan-finder/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-zero-byte-orphan-finder", fixtureFamilies: ["file-privacy", "zero-byte-orphan-finder"] },
} as const satisfies ToolManifest;

export default manifest;
