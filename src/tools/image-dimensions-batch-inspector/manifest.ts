import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const image_dimensions_batch_inspectorManifest = {
  id: "image-dimensions-batch-inspector",
  route: "/tools/image-dimensions-batch-inspector",
  name: "Image Dimensions Batch Inspector",
  summary: "Inspect several local image headers and report dimensions, MIME signatures, and bounded size guidance.",
  aliases: ["batch image dimensions","image size checker"],
  jobs: ["inspect image dimensions","check multiple image sizes"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/image-dimensions-batch-inspector/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["image-dimensions-batch-inspector"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-154", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default image_dimensions_batch_inspectorManifest;
