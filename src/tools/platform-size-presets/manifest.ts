import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const platform_size_presetsManifest = {
  id: "platform-size-presets",
  route: "/tools/platform-size-presets",
  name: "Platform Size Presets",
  summary: "Compare dimensions against a sourced platform canvas or export one verified PNG with the declared centred crop and exact preset size.",
  aliases: ["social image sizes", "platform image presets"],
  jobs: ["choose social image size", "calculate platform image size", "export platform image size"],
  category: "image-visual",
  inputTypes: ["number", "image/jpeg", "image/png", "image/webp"],
  capabilities: ["file-read", "image-decode"],
  implementation: "../tools/platform-size-presets/module.ts",
  engine: "image-visual",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["platform-size-presets"],
  gold: { maintenanceClass: "D", oracleEntryId: "cand-146", fixtureFamilies: ["platform-image-presets"] },
} as const satisfies ToolManifest;

export default platform_size_presetsManifest;
