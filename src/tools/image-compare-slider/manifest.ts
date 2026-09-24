import type { ToolManifest } from "../../catalog/manifest";

export const image_compare_sliderManifest = {
  id: "image-compare-slider",
  route: "/tools/image-compare-slider",
  name: "Image Compare",
  summary: "Compare two local images with a deterministic pixel-difference summary and metadata.",
  aliases: ["image compare","image compare slider","before after image"],
  jobs: ["compare two images","inspect image difference"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/image-compare-slider/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-159", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default image_compare_sliderManifest;
