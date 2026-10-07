import type { ToolManifest } from "../../catalog/manifest";

export const interestSavingsCalculatorManifest = {
  id: "interest-savings-calculator",
  route: "/tools/interest-savings-calculator",
  name: "Interest and Savings Goal Calculator",
  summary: "Calculate simple or compound interest, periodic savings growth, and the contribution required to reach a declared goal.",
  aliases: ["compound interest calculator", "savings goal calculator", "periodic contribution calculator"],
  jobs: ["calculate simple or compound interest", "project periodic savings contributions", "calculate required savings contribution"],
  category: "business-math",
  inputTypes: ["money", "percent", "number"],
  implementation: "../tools/interest-savings-calculator/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "EUR" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-207", fixtureFamilies: ["calculator-math-core"] },
} as const satisfies ToolManifest;

export default interestSavingsCalculatorManifest;
