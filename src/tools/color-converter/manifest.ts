import type { ToolManifest } from "../../catalog/manifest";

export const color_converterManifest = {
  id: "color-converter",
  route: "/tools/color-converter",
  name: "Color Converter",
  summary: "Convert hexadecimal colors to RGB and HSL locally with explicit channel rounding.",
  aliases: ["hex to rgb","rgb to hex","color converter"],
  jobs: ["convert color values","convert hex to hsl"],
  category: "image-visual",
  inputTypes: ["color","number"],
  implementation: "../tools/color-converter/module.ts",
  engine: "image-visual",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-150", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default color_converterManifest;
