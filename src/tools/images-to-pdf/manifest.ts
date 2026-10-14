import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const imagesToPdfManifest = {
  id: "images-to-pdf",
  route: "/tools/images-to-pdf",
  name: "Images to PDF",
  summary: "Make PDFs from JPG, PNG, WebP, AVIF or first-frame GIF with layout controls. HEIC/HEIF not approved pending real iPhone/mobile verification.",
  aliases: ["jpg to pdf", "jpeg to pdf", "png to pdf", "webp to pdf", "avif to pdf", "gif to pdf", "make pdf from images"],
  jobs: ["convert jpeg images to pdf", "convert png to pdf", "convert webp to pdf", "make a pdf from photos", "combine images into pdf"],
  category: "documents",
  inputTypes: ["image/jpeg","image/png","image/webp","image/avif","image/gif"],
  capabilities: ["file-read", "file-write", "image-decode"],
  implementation: "../tools/images-to-pdf/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["images-to-pdf"],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-126", fixtureFamilies: ["pdf-signature", "mime-file-signatures", "pdf-gold"] },
} as const satisfies ToolManifest;

export default imagesToPdfManifest;
