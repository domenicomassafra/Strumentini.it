import type { ToolManifest } from "../../catalog/manifest";

export const conversionRateScenarioManifest = {
  id: "conversion-rate-scenario",
  route: "/tools/conversion-rate-scenario",
  name: "Conversion-Rate Scenario Calculator",
  summary: "Compare baseline and target conversion rates and project conversions from visits with exact arithmetic.",
  aliases: ["conversion scenario calculator", "conversion rate projection"],
  jobs: ["project conversions at a target rate", "compare conversion rate scenarios"],
  category: "marketing",
  inputTypes: ["number", "text"],
  implementation: "../tools/conversion-rate-scenario/module.ts",
  engine: "marketing-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-080", fixtureFamilies: ["marketing-math"] },
} as const satisfies ToolManifest;

export default conversionRateScenarioManifest;
