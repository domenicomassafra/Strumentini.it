import type { ToolManifest } from "../../catalog/manifest";

export const dominant_color_extractorManifest = {
  id: "dominant-color-extractor",
  route: "/tools/dominant-color-extractor",
  name: "Dominant Color Extractor",
  summary: "Find the dominant quantized color from a bounded local image sample.",
  aliases: ["dominant image color","image color finder"],
  jobs: ["find dominant color","extract main image color"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/dominant-color-extractor/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-153", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default dominant_color_extractorManifest;
