import type { ToolManifest } from "../../catalog/manifest";

export const breakEvenManifest = {
  id: "break-even",
  route: "/tools/break-even",
  name: "Break-even Calculator",
  summary: "Find the smallest unit count and revenue needed to cover fixed and variable costs.",
  aliases: ["break even calculator", "break-even units", "contribution margin calculator"],
  jobs: ["calculate break-even units", "find break-even revenue", "check contribution margin"],
  category: "business-math",
  inputTypes: ["money", "decimal", "units"],
  implementation: "../tools/break-even/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-110", fixtureFamilies: ["business-math"] },
} as const satisfies ToolManifest;

export default breakEvenManifest;
