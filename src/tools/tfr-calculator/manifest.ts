import type { ToolManifest } from "../../catalog/manifest";

export const tfrCalculatorManifest = {
  id: "tfr-calculator",
  route: "/tools/tfr-calculator",
  name: "Calcolo TFR lordo e rivalutazione",
  summary: "Stima in locale il TFR lordo anno per anno, separando quote e rivalutazione FOI e segnalando gli indici mancanti.",
  aliases: ["calcolo trattamento fine rapporto", "rivalutazione tfr", "accantonamento tfr"],
  jobs: ["calcolare tfr lordo annuale", "calcolare rivalutazione foi del tfr", "distinguere quota tfr e rivalutazione"],
  category: "business-math",
  inputTypes: ["number", "year", "money"],
  implementation: "../tools/tfr-calculator/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["reset", "provenance"] },
  gold: { maintenanceClass: "R", oracleEntryId: "cand-270", fixtureFamilies: ["tfr-accrual-15"] },
} as const satisfies ToolManifest;

export default tfrCalculatorManifest;
