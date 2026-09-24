import type { ToolManifest } from "../../catalog/manifest";

export const contact_sheet_generatorManifest = {
  id: "contact-sheet-generator",
  route: "/tools/contact-sheet-generator",
  name: "Contact Sheet Generator",
  summary: "Compose selected local images into one bounded contact sheet in a browser canvas.",
  aliases: ["contact sheet","image thumbnail sheet"],
  jobs: ["make image contact sheet","combine image thumbnails"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/contact-sheet-generator/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-156", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default contact_sheet_generatorManifest;
