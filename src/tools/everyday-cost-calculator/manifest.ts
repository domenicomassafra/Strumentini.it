import type { ToolManifest } from "../../catalog/manifest";

export const everydayCostCalculatorManifest = {
  id: "everyday-cost-calculator",
  route: "/tools/everyday-cost-calculator",
  name: "Everyday Cost Calculator Bundle",
  summary: "Calculate normalized unit prices, bill splits, annual subscriptions, energy, car-trip and salary-hourly costs with explicit assumptions.",
  aliases: ["unit price calculator", "split bill calculator", "energy cost calculator", "trip cost calculator", "salary hourly calculator"],
  jobs: ["compare unit price", "split bill with tip", "annualize subscription cost", "estimate energy or trip cost", "convert salary and hourly rate"],
  category: "business-math",
  inputTypes: ["money", "number", "percent", "unit"],
  implementation: "../tools/everyday-cost-calculator/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "EUR" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-223", fixtureFamilies: ["business-math-expansion"] },
} as const satisfies ToolManifest;

export default everydayCostCalculatorManifest;
