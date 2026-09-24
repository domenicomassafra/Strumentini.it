import type { ToolManifest } from "../../catalog/manifest";

export const image_cropManifest = {
  id: "image-crop",
  route: "/tools/image-crop",
  name: "Image Crop",
  summary: "Crop a local image to a bounded top-left rectangle with browser-local output.",
  aliases: ["image crop","crop photo"],
  jobs: ["crop an image","crop image to size"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/image-crop/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-142", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default image_cropManifest;
