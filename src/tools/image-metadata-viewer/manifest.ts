import type { ToolManifest } from "../../catalog/manifest";

export const image_metadata_viewerManifest = {
  id: "image-metadata-viewer",
  route: "/tools/image-metadata-viewer",
  name: "Image Metadata Viewer",
  summary: "Inspect bounded local image headers, dimensions, signatures, and file size without decoding or uploading the file.",
  aliases: ["image metadata","image header viewer"],
  jobs: ["inspect image metadata","view image dimensions"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/image-metadata-viewer/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-147", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default image_metadata_viewerManifest;
