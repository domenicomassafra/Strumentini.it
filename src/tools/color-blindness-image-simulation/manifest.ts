import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const colorBlindnessImageSimulationManifest = {
  id: "color-blindness-image-simulation",
  route: "/tools/color-blindness-image-simulation",
  name: "Color Vision Deficiency Image Simulation",
  summary: "Simulate documented protanopia, deuteranopia, or tritanopia transforms on a local image and export a verified PNG for comparison.",
  aliases: ["color blindness simulator", "simulate protanopia", "simulate deuteranopia", "simulate tritanopia"],
  jobs: ["simulate color vision deficiency on an image", "compare original image with a dichromacy simulation"],
  category: "files-assets",
  inputTypes: ["image/jpeg", "image/png", "image/webp"],
  capabilities: ["file-read", "image-decode"],
  implementation: "../tools/color-blindness-image-simulation/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["color-blindness-image-simulation"],
  gold: {
    maintenanceClass: "R",
    oracleEntryId: "cand-244",
    fixtureFamilies: ["color-vision-simulation"],
  },
} as const satisfies ToolManifest;

export default colorBlindnessImageSimulationManifest;
