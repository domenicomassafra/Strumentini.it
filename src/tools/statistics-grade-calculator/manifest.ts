import type { ToolManifest } from "../../catalog/manifest";

export const statisticsGradeCalculatorManifest = {
  id: "statistics-grade-calculator",
  route: "/tools/statistics-grade-calculator",
  name: "Descriptive Statistics, Grades and Completion",
  summary: "Calculate descriptive statistics, explicit population/sample variance, weighted averages, grades, and completion percentages locally.",
  aliases: ["mean median mode calculator", "standard deviation calculator", "weighted grade calculator", "completion percentage"],
  jobs: ["calculate descriptive statistics", "calculate a weighted average", "calculate completion percentage"],
  category: "business-math",
  inputTypes: ["number-list", "number", "percent"],
  implementation: "../tools/statistics-grade-calculator/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-206", fixtureFamilies: ["calculator-math-core"] },
} as const satisfies ToolManifest;

export default statisticsGradeCalculatorManifest;
