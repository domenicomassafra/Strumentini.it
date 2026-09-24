import type { ToolManifest } from "../../catalog/manifest";

export const image_format_conversionManifest = {
  id: "image-format-conversion",
  route: "/tools/image-format-conversion",
  name: "Image Format Conversion",
  summary: "Convert a local JPEG, PNG, or WebP image to a verified browser-supported output format.",
  aliases: ["convert image format","image format converter"],
  jobs: ["convert image format","change image file format"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/image-format-conversion/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-143", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default image_format_conversionManifest;
