import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const image_cropManifest = {
  id: "image-crop",
  route: "/tools/image-crop",
  name: "Image Crop",
  summary: "Crop/rotate/adjust images or straighten a photographed document from four validated corners with one exact local preview/export pixel pipeline.",
  aliases: ["image crop","crop photo","rotate image","round crop image","flip image","brightness contrast saturation image","perspective straighten","document perspective correction"],
  jobs: ["crop an image","crop image to size","rotate and flip an image","round crop an image","add image border or background","adjust image brightness contrast and saturation","straighten document perspective with four corners"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  capabilities: ["file-read", "image-decode"],
  implementation: "../tools/image-crop/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["image-crop"],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-142", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default image_cropManifest;
