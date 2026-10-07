import type { FactoryToolManifest } from "../../tool-factory/manifest";

export const gestioneSeparataContributiManifest = {
  id: "gestione-separata-contributi",
  route: "/tools/gestione-separata-contributi",
  name: "Gestione Separata INPS 2026",
  summary: "Calcola i contributi 2026 per i due profili professionista coperti dalla circolare INPS, con base, massimale e soglia di accredito.",
  aliases: ["gestione separata 2026", "contributi professionista inps", "aliquota gestione separata"],
  keywords: ["INPS", "gestione separata", "professionista", "contributi", "2026"],
  jobs: ["calcolare contributi Gestione Separata 2026", "confrontare aliquote professionista Gestione Separata", "vedere massimale e soglia accredito"],
  category: "business-math",
  inputTypes: ["money", "year", "profile"],
  packIds: [],
  roleTags: [],
  implementation: "../tools/gestione-separata-contributi/module.ts",
  engine: "business-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  privacyClass: "LOCAL",
  capabilities: [],
  profileFields: [],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "R", oracleEntryId: "cand-257", fixtureFamilies: ["italy-2026-consumers"] },
  version: "1.0.0",
  deterministic: true,
  dependencies: [],
  lazyDependencies: [],
  bundle: { eager: false, lazy: true, initialBytes: 0, maxBytes: 250000 },
  offline: "FULL",
  acceptance: { independentOracle: true, fixtureFamilies: ["italy-2026-consumers"], privacy: true, accessibility: true, bundle: true },
  page: { component: "GestioneSeparataContributiTool", clientDirective: "load" },
} as const satisfies FactoryToolManifest;

export default gestioneSeparataContributiManifest;
