import type { ToolManifest } from "../../catalog/manifest";

export const pdfCompressionManifest = {
  id: "pdf-compression-lite",
  route: "/tools/pdf-compression-lite",
  name: "PDF Compression Lite",
  summary: "Create a bounded local PDF copy with addressable metadata removed and uncompressed content whitespace normalized.",
  aliases: ["compress pdf locally", "pdf size reducer", "lightweight pdf cleanup"],
  jobs: ["compress a pdf", "reduce pdf whitespace", "optimize pdf locally"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-compression-lite/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-139", fixtureFamilies: ["pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfCompressionManifest;
