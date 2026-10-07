import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const color_converterManifest = {
  id: "color-converter",
  route: "/tools/color-converter",
  name: "Color Converter",
  summary: "Convert CSS colors locally and generate deterministic HSL harmonies or encoded-sRGB tints/shades with explicit rules.",
  aliases: ["hex to rgb","rgb to hex","color converter","CSS named colors","color harmony","tints and shades"],
  jobs: ["convert color values","convert hex to hsl","resolve CSS named color","generate color harmonies","generate tints and shades"],
  category: "image-visual",
  inputTypes: ["color","number"],
  implementation: "../tools/color-converter/module.ts",
  engine: "image-visual",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["color-converter"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-150", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default color_converterManifest;
