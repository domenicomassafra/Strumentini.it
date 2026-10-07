import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const perceptual_duplicate_finderManifest = {
  id: "perceptual-duplicate-finder",
  route: "/tools/perceptual-duplicate-finder",
  name: "Perceptual Duplicate Finder",
  summary: "Compare bounded local image pixel samples to find near-duplicate dimensions and color signatures.",
  aliases: ["duplicate image finder","perceptual image dedupe"],
  jobs: ["find duplicate images","find visually similar images"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/perceptual-duplicate-finder/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["perceptual-duplicate-finder"],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-160", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default perceptual_duplicate_finderManifest;
