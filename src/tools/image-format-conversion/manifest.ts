import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const image_format_conversionManifest = {
  id: "image-format-conversion",
  route: "/tools/image-format-conversion",
  name: "Image Format Conversion",
  summary: "Convert JPG/JPEG, PNG, WebP, AVIF, HEIC/HEIF and the first GIF frame locally to PNG, JPEG or WebP with verified output and explicit fidelity limits.",
  aliases: ["convert image format","image format converter","jpg to png","jpeg to png","png to jpg","png to jpeg","jpg to webp","jpeg to webp","webp to jpg","webp to png","heic to jpg","heic to jpeg","heic to png","heic to webp","heif to jpg","avif to jpg","avif to png","gif to jpg","gif to png"],
  jobs: ["convert image format","change image file format","convert JPG to PNG","convert PNG to JPG","convert JPG to WebP","convert WebP to PNG","convert HEIC or HEIF to JPG PNG or WebP","convert AVIF to JPG or PNG","extract the first GIF frame to JPG PNG or WebP"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp","image/avif","image/heic","image/heif","image/gif"],
  capabilities: ["file-read", "image-decode"],
  implementation: "../tools/image-format-conversion/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["image-format-conversion"],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-143", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default image_format_conversionManifest;
