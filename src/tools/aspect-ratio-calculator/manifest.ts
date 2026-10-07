import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const aspect_ratio_calculatorManifest = {
  id: "aspect-ratio-calculator",
  route: "/tools/aspect-ratio-calculator",
  name: "Aspect Ratio Calculator",
  summary: "Calculate a simplified image aspect ratio and bounded fit dimensions without uploading dimensions.",
  aliases: ["image ratio calculator","picture ratio"],
  jobs: ["calculate image aspect ratio","find image ratio"],
  category: "image-visual",
  inputTypes: ["color","number"],
  implementation: "../tools/aspect-ratio-calculator/module.ts",
  engine: "image-visual",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["aspect-ratio-calculator"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-145", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default aspect_ratio_calculatorManifest;
