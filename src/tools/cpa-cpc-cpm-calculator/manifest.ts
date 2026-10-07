import type { ToolManifest } from "../../catalog/manifest";

export const cpaCpcCpmCalculatorManifest = {
  id: "cpa-cpc-cpm-calculator",
  route: "/tools/cpa-cpc-cpm-calculator",
  name: "CPA / CPC / CPM Calculator",
  summary: "Calculate CPA, CPC, or CPM from spend and an explicit denominator with visible units and formulas.",
  aliases: ["ad cost calculator", "cpc cpa cpm helper"],
  jobs: ["calculate cost per acquisition", "calculate cpc or cpm"],
  category: "marketing",
  inputTypes: ["number", "text"],
  implementation: "../tools/cpa-cpc-cpm-calculator/module.ts",
  engine: "marketing-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-079", fixtureFamilies: ["marketing-math"] },
} as const satisfies ToolManifest;

export default cpaCpcCpmCalculatorManifest;
