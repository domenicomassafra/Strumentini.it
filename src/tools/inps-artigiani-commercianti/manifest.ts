import type { FactoryToolManifest } from "../../tool-factory/manifest";

export const inpsArtigianiCommerciantiManifest = {
  id: "inps-artigiani-commercianti",
  route: "/tools/inps-artigiani-commercianti",
  name: "INPS Artigiani e Commercianti 2026",
  summary: "Calcola il profilo standard 2026 di artigiani e commercianti con minimale, fasce, massimale e fonti INPS esplicite.",
  aliases: ["contributi inps artigiani", "contributi commercianti 2026", "inps artigiano commerciante"],
  keywords: ["INPS", "artigiani", "commercianti", "contributi", "2026"],
  jobs: ["calcolare contributi INPS artigiani 2026", "calcolare contributi INPS commercianti 2026", "vedere minimale fasce e massimale INPS"],
  category: "business-math",
  inputTypes: ["money", "year", "profile"],
  packIds: [],
  roleTags: [],
  implementation: "../tools/inps-artigiani-commercianti/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  privacyClass: "LOCAL",
  capabilities: [],
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "R", oracleEntryId: "cand-256", fixtureFamilies: ["italy-2026-consumers"] },
  version: "1.0.0",
  deterministic: true,
  dependencies: [],
  lazyDependencies: [],
  bundle: { eager: false, lazy: true, initialBytes: 0, maxBytes: 250000 },
  offline: "FULL",
  acceptance: { independentOracle: true, fixtureFamilies: ["italy-2026-consumers"], privacy: true, accessibility: true, bundle: true },
  page: { component: "InpsArtigianiCommerciantiTool", clientDirective: "load" },
} as const satisfies FactoryToolManifest;

export default inpsArtigianiCommerciantiManifest;
