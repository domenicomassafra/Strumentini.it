import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const image_rename_batch_previewManifest = {
  id: "image-rename-batch-preview",
  route: "/tools/image-rename-batch-preview",
  name: "Image Rename Batch Preview",
  summary: "Preview deterministic filename changes for local images without writing or uploading anything.",
  aliases: ["batch rename images","image filename preview"],
  jobs: ["preview image renames","rename image files safely"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/image-rename-batch-preview/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["image-rename-batch-preview"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-155", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default image_rename_batch_previewManifest;
