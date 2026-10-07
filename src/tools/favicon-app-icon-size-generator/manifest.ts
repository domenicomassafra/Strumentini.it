import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const favicon_app_icon_size_generatorManifest = {
  id: "favicon-app-icon-size-generator",
  route: "/tools/favicon-app-icon-size-generator",
  name: "Favicon / App Icon Size Generator",
  summary: "Generate verified square PNG favicon/app-icon variants in deterministic size order and package the exact preview list in a STORE-only ZIP.",
  aliases: ["favicon generator","app icon sizes"],
  jobs: ["generate favicon sizes","create app icon sizes"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  capabilities: ["file-read", "image-decode"],
  implementation: "../tools/favicon-app-icon-size-generator/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["favicon-app-icon-size-generator"],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-157", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default favicon_app_icon_size_generatorManifest;
