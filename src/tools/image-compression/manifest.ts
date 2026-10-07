import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const image_compressionManifest = {
  id: "image-compression",
  route: "/tools/image-compression",
  name: "Image Compression",
  summary: "Compress a local image to a selected browser-supported format and verify the result.",
  aliases: ["compress image","image compressor"],
  jobs: ["compress an image","reduce image file size"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/image-compression/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["image-compression"],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-144", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default image_compressionManifest;
