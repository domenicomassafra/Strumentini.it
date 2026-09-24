import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "filename-sanitizer",
  route: "/tools/filename-sanitizer",
  name: "Filename Sanitizer",
  summary: "Preview portable names while preserving the original files.",
  aliases: ["safe filename", "sanitize file names"],
  jobs: ["sanitize a filename locally"],
  category: "files",
  inputTypes: ["text", "file"],
  implementation: "../tools/filename-sanitizer/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "filename-plan", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-168", fixtureFamilies: ["filename-sanitization"] },
} as const satisfies ToolManifest;
