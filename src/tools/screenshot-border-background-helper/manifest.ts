import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const screenshot_border_background_helperManifest = {
  id: "screenshot-border-background-helper",
  route: "/tools/screenshot-border-background-helper",
  name: "Screenshot Border / Background Helper",
  summary: "Add borders/backgrounds, exact-preview watermarks/overlays, or manually confirmed screenshot stitching with local bounded canvas output.",
  aliases: ["screenshot border","image background helper","image watermark","screenshot stitch","overlay image"],
  jobs: ["add border to screenshot","add image background","add text or image watermark","compose image overlay","stitch screenshots with overlap correction"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  capabilities: ["file-read", "image-decode"],
  implementation: "../tools/screenshot-border-background-helper/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["screenshot-border-background-helper"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-158", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default screenshot_border_background_helperManifest;
