import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const exif_removerManifest = {
  id: "exif-remover",
  route: "/tools/exif-remover",
  name: "EXIF Remover",
  summary: "Rebuild a local PNG from the decoded pixels and prove byte by byte that no Exif, XMP, IPTC or comment survives.",
  aliases: ["remove exif", "strip image metadata"],
  jobs: ["remove exif metadata", "strip image metadata"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  capabilities: ["file-read", "image-decode"],
  implementation: "../tools/exif-remover/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["exif-remover"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-148", fixtureFamilies: ["image-metadata", "image-metadata-segments", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default exif_removerManifest;
