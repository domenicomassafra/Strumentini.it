import type { ToolManifest } from "../../catalog/manifest";

export const cssDesignHelperManifest = {
  id: "css-design-helper",
  route: "/tools/css-design-helper",
  name: "CSS Gradient, Shadow & Radius Helper",
  summary: "Build validated linear-gradient, box-shadow, and border-radius CSS from one canonical local value model with a live preview.",
  aliases: ["CSS gradient generator", "box shadow generator", "border radius generator", "CSS design helper"],
  jobs: ["generate CSS gradient", "generate box shadow", "generate border radius", "preview CSS design value"],
  category: "developer",
  inputTypes: ["color", "number", "css"],
  implementation: "../tools/css-design-helper/module.ts",
  engine: "design-css",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-242", fixtureFamilies: ["css-design-helper"] },
} as const satisfies ToolManifest;

export default cssDesignHelperManifest;
