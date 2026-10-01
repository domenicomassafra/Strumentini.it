import type { ToolManifest } from "../../catalog/manifest";

export const imagesToPdfManifest = {
  id: "images-to-pdf",
  route: "/tools/images-to-pdf",
  name: "Images to PDF",
  summary: "Turn bounded local JPEG images into a page-per-image PDF without a server converter.",
  aliases: ["jpg to pdf", "jpeg to pdf", "make pdf from images"],
  jobs: ["convert jpeg images to pdf", "make a pdf from photos", "combine images into pdf"],
  category: "documents",
  inputTypes: ["image/jpeg"],
  capabilities: ["file-read", "file-write", "image-decode"],
  implementation: "../tools/images-to-pdf/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-126", fixtureFamilies: ["pdf-signature", "mime-file-signatures", "pdf-gold"] },
} as const satisfies ToolManifest;

export default imagesToPdfManifest;
