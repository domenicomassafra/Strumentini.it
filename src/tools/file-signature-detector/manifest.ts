import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "file-signature-detector",
  route: "/tools/file-signature-detector",
  name: "File Signature / Type Detector",
  summary: "Inspect bounded file signatures and compare them with filename extensions.",
  aliases: ["file type detector", "magic bytes", "mime signature"],
  jobs: ["detect a file signature"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/file-signature-detector/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "validator", capabilities: ["copy", "retry", "reset", "provenance"] },
  handoff: { emits: [{ type: "structured", format: "signature-report", maxBytes: 2_097_152 }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-164", fixtureFamilies: ["mime-file-signatures"] },
} as const satisfies ToolManifest;
