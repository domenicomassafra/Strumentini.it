import type { ToolManifest } from "../../catalog/manifest";

export const platform_size_presetsManifest = {
  id: "platform-size-presets",
  route: "/tools/platform-size-presets",
  name: "Platform Size Presets",
  summary: "Preview common social and app image dimensions with contain and cover calculations.",
  aliases: ["social image sizes","platform image presets"],
  jobs: ["choose social image size","calculate platform image size"],
  category: "image-visual",
  inputTypes: ["color","number"],
  implementation: "../tools/platform-size-presets/module.ts",
  engine: "image-visual",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-146", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default platform_size_presetsManifest;
