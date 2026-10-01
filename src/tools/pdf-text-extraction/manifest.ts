import type { ToolManifest } from "../../catalog/manifest";

export const pdfTextExtractionManifest = {
  id: "pdf-text-extraction",
  route: "/tools/pdf-text-extraction",
  name: "PDF Text Extraction",
  summary: "Extract bounded text operators from local PDF content streams with explicit filter limits.",
  aliases: ["extract pdf text", "pdf text reader", "get text from pdf"],
  jobs: ["extract text from pdf", "read pdf text locally", "copy text from pdf"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read"],
  implementation: "../tools/pdf-text-extraction/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "text", format: "plain" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-128", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfTextExtractionManifest;
