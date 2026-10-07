import type { ToolManifest } from "../../catalog/manifest";

export const scientificCalculatorManifest = {
  id: "scientific-calculator",
  route: "/tools/scientific-calculator",
  name: "Scientific Expression Calculator",
  summary: "Evaluate bounded arithmetic expressions with documented functions and constants using a parser with no eval or code execution.",
  aliases: ["scientific calculator", "expression calculator", "math expression evaluator"],
  jobs: ["calculate a scientific expression", "evaluate arithmetic with parentheses and functions"],
  category: "business-math",
  inputTypes: ["text", "number", "expression"],
  implementation: "../tools/scientific-calculator/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-204", fixtureFamilies: ["calculator-math-core"] },
} as const satisfies ToolManifest;

export default scientificCalculatorManifest;
