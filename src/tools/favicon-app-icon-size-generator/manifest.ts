import type { ToolManifest } from "../../catalog/manifest";

export const favicon_app_icon_size_generatorManifest = {
  id: "favicon-app-icon-size-generator",
  route: "/tools/favicon-app-icon-size-generator",
  name: "Favicon / App Icon Size Generator",
  summary: "Generate a bounded set of square favicon and app-icon PNG sizes from one local image.",
  aliases: ["favicon generator","app icon sizes"],
  jobs: ["generate favicon sizes","create app icon sizes"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/favicon-app-icon-size-generator/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-157", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default favicon_app_icon_size_generatorManifest;
