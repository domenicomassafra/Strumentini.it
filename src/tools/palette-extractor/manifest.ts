import type { ToolManifest } from "../../catalog/manifest";

export const palette_extractorManifest = {
  id: "palette-extractor",
  route: "/tools/palette-extractor",
  name: "Palette Extractor",
  summary: "Extract a bounded local color palette from decoded image pixels using deterministic quantization.",
  aliases: ["image palette","extract colors from image"],
  jobs: ["extract image palette","find image colors"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/palette-extractor/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "H", oracleEntryId: "cand-152", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default palette_extractorManifest;
