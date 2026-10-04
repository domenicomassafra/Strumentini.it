import type { ToolManifest } from "../../catalog/manifest";

export const exif_removerManifest = {
  id: "exif-remover",
  route: "/tools/exif-remover",
  name: "EXIF Remover",
  summary: "Rebuild a local PNG from the decoded pixels and prove byte by byte that no Exif, XMP, IPTC or comment survives.",
  aliases: ["remove exif", "strip image metadata"],
  jobs: ["remove exif metadata", "strip image metadata"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/exif-remover/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-148", fixtureFamilies: ["image-metadata", "image-metadata-segments", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default exif_removerManifest;
