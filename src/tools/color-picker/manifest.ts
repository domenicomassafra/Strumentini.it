import type { ToolManifest } from "../../catalog/manifest";

export const color_pickerManifest = {
  id: "color-picker",
  route: "/tools/color-picker",
  name: "Color Picker",
  summary: "Pick a color with a native browser control and inspect its exact RGB, HSL, and hexadecimal values.",
  aliases: ["pick color","colour picker"],
  jobs: ["choose a color","inspect a color"],
  category: "image-visual",
  inputTypes: ["color","number"],
  implementation: "../tools/color-picker/module.ts",
  engine: "image-visual",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-149", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default color_pickerManifest;
