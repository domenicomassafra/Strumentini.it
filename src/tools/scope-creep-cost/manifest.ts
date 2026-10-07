import type { ToolManifest } from "../../catalog/manifest";

export const scopeCreepCostManifest = {
  id: "scope-creep-cost",
  route: "/tools/scope-creep-cost",
  name: "Scope-creep Cost Calculator",
  summary: "Price additional work against the original hourly basis and show the revised project cost.",
  aliases: ["scope creep calculator", "additional work cost", "change order cost"],
  jobs: ["calculate scope creep cost", "price additional hours", "compare project budget variance"],
  category: "business-math",
  inputTypes: ["money", "hours", "decimal"],
  implementation: "../tools/scope-creep-cost/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-107", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default scopeCreepCostManifest;
