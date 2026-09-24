import type { ToolManifest } from "../../catalog/manifest";

export const exif_removerManifest = {
  id: "exif-remover",
  route: "/tools/exif-remover",
  name: "EXIF Remover",
  summary: "Create a new local image output from decoded pixels and state the bounded metadata policy explicitly.",
  aliases: ["remove exif","strip image metadata"],
  jobs: ["remove exif metadata","strip image metadata"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/exif-remover/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-148", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default exif_removerManifest;
