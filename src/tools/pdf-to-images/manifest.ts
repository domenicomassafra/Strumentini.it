import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfToImagesManifest = {
  id: "pdf-to-images",
  route: "/tools/pdf-to-images",
  name: "PDF to Images",
  summary: "Render selected PDF pages locally to JPG, PNG or WebP with scale/DPI and quality controls; multi-page output also includes a verified ZIP.",
  aliases: ["pdf image export", "pdf to jpg", "pdf to jpeg", "pdf to png", "pdf to webp", "convert pdf pages to images"],
  jobs: ["convert pdf to jpg", "convert pdf to png", "convert pdf to webp", "render selected PDF pages to images"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write", "image-decode"],
  implementation: "../tools/pdf-to-images/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-to-images"],
  handoff: { emits: [{ type: "image", format: "jpeg/png/webp" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-127", fixtureFamilies: ["pdf-signature", "mime-file-signatures", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfToImagesManifest;
