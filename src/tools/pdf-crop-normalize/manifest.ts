import type { ToolManifest } from "../../catalog/manifest";

export const pdfCropNormalizeManifest = {
  id: "pdf-crop-normalize",
  route: "/tools/pdf-crop-normalize",
  name: "PDF Crop and Page Size",
  summary: "Crop visible PDF page boxes or uniformly fit/center selected pages into A4, Letter or custom size; original content streams stay intact.",
  aliases: ["crop pdf visible pages", "normalize pdf page sizes", "resize page boxes"],
  jobs: ["hide margins with PDF CropBox", "fit pages onto A4 size", "center PDF contents on target page"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-crop-normalize/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "pdf", capabilities: ["download", "reset", "retry"] },
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-264", fixtureFamilies: ["pdf-gold", "pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfCropNormalizeManifest;
