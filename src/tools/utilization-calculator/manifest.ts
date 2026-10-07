import type { ToolManifest } from "../../catalog/manifest";

export const utilizationCalculatorManifest = {
  id: "utilization-calculator",
  route: "/tools/utilization-calculator",
  name: "Utilization Calculator",
  summary: "Compare billable hours with available hours and expose the exact unbilled remainder.",
  aliases: ["utilization rate", "billable utilization", "capacity utilization"],
  jobs: ["calculate utilization", "measure billable hours", "find unbilled capacity"],
  category: "business-math",
  inputTypes: ["hours", "decimal"],
  implementation: "../tools/utilization-calculator/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-104", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default utilizationCalculatorManifest;
