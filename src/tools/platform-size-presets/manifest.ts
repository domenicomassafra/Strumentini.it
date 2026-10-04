import type { ToolManifest } from "../../catalog/manifest";

export const platform_size_presetsManifest = {
  id: "platform-size-presets",
  route: "/tools/platform-size-presets",
  name: "Platform Size Presets",
  summary: "Compare an image against a published social or app canvas, with the centred crop, the contained box and the upscale factor, each bound to its documented source.",
  aliases: ["social image sizes", "platform image presets"],
  jobs: ["choose social image size", "calculate platform image size"],
  category: "image-visual",
  inputTypes: ["number"],
  implementation: "../tools/platform-size-presets/module.ts",
  engine: "image-visual",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "D", oracleEntryId: "cand-146", fixtureFamilies: ["platform-image-presets"] },
} as const satisfies ToolManifest;

export default platform_size_presetsManifest;
