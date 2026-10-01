import type { ToolManifest } from "../../catalog/manifest";

export const pdfToImagesManifest = {
  id: "pdf-to-images",
  route: "/tools/pdf-to-images",
  name: "PDF to Images",
  summary: "Extract directly embedded JPEG image streams from a PDF without pretending to render unsupported pages.",
  aliases: ["pdf image export", "extract pdf jpegs", "pdf to jpg"],
  jobs: ["extract images from pdf", "export embedded pdf images", "save pdf jpeg streams"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write", "image-decode"],
  implementation: "../tools/pdf-to-images/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "image", format: "jpeg" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-127", fixtureFamilies: ["pdf-signature", "mime-file-signatures", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfToImagesManifest;
