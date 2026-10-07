import type { ToolManifest } from "../../catalog/manifest";

export const mortgageAmortizationCalculatorManifest = {
  id: "mortgage-amortization-calculator",
  route: "/tools/mortgage-amortization-calculator",
  name: "Mortgage, Loan & French Amortization Calculator",
  summary: "Estimate French-amortization payments for mortgages or generic loans from principal, TAN and term, with optional explicit one-time fees and CSV schedule export.",
  aliases: ["mortgage calculator", "mutuo calculator", "French amortization schedule", "loan payment calculator", "installment loan calculator", "prestito rate"],
  jobs: ["calculate mortgage payment", "calculate loan installment", "build French amortization schedule", "compare explicit loan cost", "export amortization schedule csv"],
  category: "business-math",
  inputTypes: ["money", "percent", "number"],
  implementation: "../tools/mortgage-amortization-calculator/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "EUR" }],
  handoff: { emits: [{ type: "table", format: "csv" }] },
  result: { class: "calculator", capabilities: ["copy", "download", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-221", fixtureFamilies: ["business-math-expansion"] },
} as const satisfies ToolManifest;

export default mortgageAmortizationCalculatorManifest;
