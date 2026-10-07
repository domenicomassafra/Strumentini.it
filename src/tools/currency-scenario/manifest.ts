import type { ToolManifest } from "../../catalog/manifest";

export const currencyScenarioManifest = {
  id: "currency-scenario",
  route: "/tools/currency-scenario",
  name: "Currency Scenario Calculator",
  summary: "Apply a user-entered currency rate to an amount without fetching live FX data.",
  aliases: ["currency scenario", "manual FX calculator", "exchange rate scenario"],
  jobs: ["calculate currency scenario", "apply manual exchange rate", "compare inverse currency rate"],
  category: "business-math",
  inputTypes: ["money", "rate", "currency"],
  implementation: "../tools/currency-scenario/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-120", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default currencyScenarioManifest;
