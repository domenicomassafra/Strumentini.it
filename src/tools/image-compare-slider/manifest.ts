import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const image_compare_sliderManifest = {
  id: "image-compare-slider",
  route: "/tools/image-compare-slider",
  name: "Image Compare",
  summary: "Compare two local images with slider, overlay and verified diff views plus bounded thresholded RGBA metrics and explicit no-stretch alignment.",
  aliases: ["image compare","image compare slider","before after image"],
  jobs: ["compare two images","inspect image difference"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  capabilities: ["file-read", "image-decode"],
  implementation: "../tools/image-compare-slider/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["image-compare-slider"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-159", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default image_compare_sliderManifest;
