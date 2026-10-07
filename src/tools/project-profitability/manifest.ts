import type { ToolManifest } from "../../catalog/manifest";

export const projectProfitabilityManifest = {
  id: "project-profitability",
  route: "/tools/project-profitability",
  name: "Project Profitability Calculator",
  summary: "Calculate project cost, profit, margin, and effective hourly return from explicit labor inputs.",
  aliases: ["project profit calculator", "project margin calculator", "project cost and profit"],
  jobs: ["calculate project profitability", "measure project margin", "find effective project rate"],
  category: "business-math",
  inputTypes: ["money", "hours", "decimal"],
  implementation: "../tools/project-profitability/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-115", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default projectProfitabilityManifest;
