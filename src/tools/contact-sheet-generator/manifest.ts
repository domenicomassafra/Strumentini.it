import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const contact_sheet_generatorManifest = {
  id: "contact-sheet-generator",
  route: "/tools/contact-sheet-generator",
  name: "Contact Sheet Generator",
  summary: "Build contact sheets, ordered stack/grid compositions, or exact carousel slices with deterministic PNG names and verified STORE-only ZIP output.",
  aliases: ["contact sheet","image thumbnail sheet","combine images","image grid","carousel slicer","social image slices"],
  jobs: ["make image contact sheet","combine image thumbnails","stack images horizontally or vertically","compose image grid","slice image for carousel"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  capabilities: ["file-read", "image-decode"],
  implementation: "../tools/contact-sheet-generator/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["contact-sheet-generator"],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-156", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default contact_sheet_generatorManifest;
