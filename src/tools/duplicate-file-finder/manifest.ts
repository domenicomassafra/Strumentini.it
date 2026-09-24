import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "duplicate-file-finder",
  route: "/tools/duplicate-file-finder",
  name: "Duplicate File Finder",
  summary: "Find exact duplicate files in a bounded local selection using size and SHA-256.",
  aliases: ["find duplicate files", "content duplicate finder"],
  jobs: ["find exact duplicate files"],
  category: "files",
  inputTypes: ["file", "folder"],
  implementation: "../tools/duplicate-file-finder/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "duplicate-groups", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-167", fixtureFamilies: ["file-hash"] },
} as const satisfies ToolManifest;
