import type { FactoryToolManifest } from "../../tool-factory/manifest";

export const fatturaPaReaderManifest = {
  id: "fatturapa-reader",
  route: "/tools/fatturapa-reader",
  name: "Lettore FatturaPA XML",
  summary: "Legge una FatturaPA XML supportata interamente in locale, mostrando schema, parti, dati documento, righe ed errori isolati.",
  aliases: ["lettore fatturapa", "leggi fattura elettronica xml", "fatturapa xml reader"],
  keywords: ["FatturaPA", "XML", "fattura elettronica", "XSD", "locale"],
  jobs: ["leggere una FatturaPA XML", "controllare versione e namespace FatturaPA", "vedere righe e totali di una fattura elettronica"],
  category: "files",
  inputTypes: ["file", "xml", "invoice"],
  packIds: [],
  roleTags: [],
  implementation: "../tools/fatturapa-reader/module.ts",
  engine: "table-csv",
  runtime: { location: "LOCAL", network: "forbidden" },
  privacyClass: "LOCAL",
  capabilities: ["file-read"],
  profileFields: [],
  result: { class: "file", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "R", oracleEntryId: "cand-255", fixtureFamilies: ["italy-2026-consumers"] },
  version: "1.0.0",
  deterministic: true,
  dependencies: [],
  lazyDependencies: [],
  bundle: { eager: false, lazy: true, initialBytes: 0, maxBytes: 300000 },
  offline: "FULL",
  acceptance: { independentOracle: true, fixtureFamilies: ["italy-2026-consumers"], privacy: true, accessibility: true, bundle: true },
  page: { component: "FatturaPaReaderTool", clientDirective: "load" },
} as const satisfies FactoryToolManifest;

export default fatturaPaReaderManifest;
