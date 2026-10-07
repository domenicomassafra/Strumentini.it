import type { ToolManifest } from "../../catalog/manifest";

export const roasCalculatorManifest = {
  id: "roas-calculator",
  route: "/tools/roas-calculator",
  name: "ROAS Calculator",
  summary: "Calculate return on ad spend with exact decimal arithmetic and explicit final-only rounding.",
  aliases: ["return on ad spend", "ad spend return calculator"],
  jobs: ["calculate roas", "compare campaign return to spend"],
  category: "marketing",
  inputTypes: ["number", "text"],
  implementation: "../tools/roas-calculator/module.ts",
  engine: "marketing-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-078", fixtureFamilies: ["marketing-math"] },
} as const satisfies ToolManifest;

export default roasCalculatorManifest;
