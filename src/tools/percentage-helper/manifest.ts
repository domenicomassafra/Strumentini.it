import type { ToolManifest } from "../../catalog/manifest";

export const percentageHelperManifest = {
  id: "percentage-helper",
  route: "/tools/percentage-helper",
  name: "Calcolatore percentuali",
  summary: "Calcola percentuali, variazioni, aumenti, riduzioni, scorpori e sconti concatenati con aritmetica decimale esatta.",
  aliases: ["calcolo percentuale", "percentage calculator", "scorporo percentuale", "variazione percentuale", "sconti concatenati"],
  jobs: ["calculate percentage of base", "find what percentage one value is of another", "increase or decrease by percentage", "calculate percentage variation", "reverse a discount", "combine cascading discounts"],
  category: "business-math",
  inputTypes: ["money", "percent", "decimal"],
  implementation: "../tools/percentage-helper/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency", defaultValue: "USD" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "R", oracleEntryId: "cand-119", fixtureFamilies: ["percentage-math"] },
} as const satisfies ToolManifest;

export default percentageHelperManifest;
