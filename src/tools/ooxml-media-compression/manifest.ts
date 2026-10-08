import type { ToolManifest } from "../../catalog/manifest";

export const ooxmlMediaCompressionManifest = {
  id: "ooxml-media-compression",
  route: "/tools/ooxml-media-compression",
  name: "OOXML Embedded Media Compression",
  summary: "Optimize embedded PNG in DOCX, PPTX and XLSX locally, with optional consent-based JPEG recompression and image resizing; preserve editable Office parts.",
  aliases: ["compress images in word", "reduce docx picture size", "compress pptx images", "compress xlsx embedded pictures", "ooxml raster optimization"],
  jobs: ["reduce embedded image bytes in DOCX", "optimize PPTX picture media", "recompress XLSX image attachments"],
  category: "documents",
  inputTypes: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  capabilities: ["file-read", "file-write", "image-decode"],
  implementation: "../tools/ooxml-media-compression/module.ts",
  engine: "ooxml",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "file", capabilities: ["download", "retry", "reset", "provenance", "before-after"] },
  handoff: { emits: [{ type: "file", format: "docx-pptx-xlsx" }] },
  // Oracle candidate metadata is mandatory in the catalog. It does not grant Gold.
  gold: { maintenanceClass: "H", oracleEntryId: "cand-263", fixtureFamilies: ["mime-file-signatures", "zip-signatures"] },
} as const satisfies ToolManifest;

export default ooxmlMediaCompressionManifest;
