import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfImageExtractorManifest = {
  id: "pdf-image-extractor",
  route: "/tools/pdf-image-extractor",
  name: "PDF Image Extractor",
  summary: "Extract page-scoped embedded JPEG bytes with page/object provenance, optional dedupe, and explicit unsupported-filter reporting.",
  aliases: ["extract pdf images", "pdf embedded jpeg export", "save images from pdf"],
  jobs: ["extract embedded pdf images by page", "export original pdf jpeg streams", "inspect pdf image object provenance"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write", "image-decode"],
  implementation: "../tools/pdf-image-extractor/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-image-extractor"],
  handoff: { emits: [{ type: "image", format: "jpeg" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-137", fixtureFamilies: ["pdf-signature", "mime-file-signatures", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfImageExtractorManifest;
