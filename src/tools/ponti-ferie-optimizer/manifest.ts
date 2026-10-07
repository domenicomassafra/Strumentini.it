import type { FactoryToolManifest } from "../../tool-factory/manifest";

export const pontiFerieOptimizerManifest = {
  id: "ponti-ferie-optimizer",
  route: "/tools/ponti-ferie-optimizer",
  name: "Ponti e ferie 2026",
  summary: "Trova ponti deterministici nel 2026 usando festività nazionali ufficiali, giorni di ferie disponibili e la tua settimana lavorativa.",
  aliases: ["ponti 2026", "ottimizzatore ferie", "calendario ponti italia"],
  keywords: ["ponti", "ferie", "festività", "2026", "calendario"],
  jobs: ["trovare ponti nel 2026", "ottimizzare giorni di ferie", "confrontare giorni liberi ottenuti con ferie usate"],
  category: "date-time",
  inputTypes: ["year", "number", "date-time"],
  packIds: [],
  roleTags: [],
  implementation: "../tools/ponti-ferie-optimizer/module.ts",
  engine: "date-time",
  runtime: { location: "LOCAL", network: "forbidden" },
  privacyClass: "LOCAL",
  capabilities: [],
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "R", oracleEntryId: "cand-258", fixtureFamilies: ["italy-2026-consumers"] },
  version: "1.0.0",
  deterministic: true,
  dependencies: [],
  lazyDependencies: [],
  bundle: { eager: false, lazy: true, initialBytes: 0, maxBytes: 250000 },
  offline: "FULL",
  acceptance: { independentOracle: true, fixtureFamilies: ["italy-2026-consumers"], privacy: true, accessibility: true, bundle: true },
  page: { component: "PontiFerieOptimizerTool", clientDirective: "load" },
} as const satisfies FactoryToolManifest;

export default pontiFerieOptimizerManifest;
