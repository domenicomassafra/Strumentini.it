import type { ToolManifest } from "../../catalog/manifest";

export const pdfImageExtractorManifest = {
  id: "pdf-image-extractor",
  route: "/tools/pdf-image-extractor",
  name: "PDF Image Extractor",
  summary: "Extract directly embedded JPEG image streams from a local PDF with explicit stream capability checks.",
  aliases: ["extract pdf images", "pdf embedded jpeg export", "save images from pdf"],
  jobs: ["extract embedded pdf images", "export pdf jpeg streams", "inspect pdf image objects"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write", "image-decode"],
  implementation: "../tools/pdf-image-extractor/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "image", format: "jpeg" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-137", fixtureFamilies: ["pdf-signature", "mime-file-signatures", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfImageExtractorManifest;
