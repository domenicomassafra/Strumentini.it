import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const contrast_checkerManifest = {
  id: "contrast-checker",
  route: "/tools/contrast-checker",
  name: "Contrast Checker",
  summary: "Check a foreground and background color pair against WCAG relative-luminance contrast ratios.",
  aliases: ["wcag contrast","color contrast checker"],
  jobs: ["check color contrast","calculate wcag contrast"],
  category: "image-visual",
  inputTypes: ["color","number"],
  implementation: "../tools/contrast-checker/module.ts",
  engine: "image-visual",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["contrast-checker"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-151", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default contrast_checkerManifest;
