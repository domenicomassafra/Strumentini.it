import type { FactoryToolManifest } from "../../tool-factory/manifest";

export const fatturaPaBatchCsvManifest = {
  id: "fatturapa-batch-csv",
  route: "/tools/fatturapa-batch-csv",
  name: "FatturaPA batch → CSV",
  summary: "Legge più FatturePA XML in locale, isola gli errori per file e crea una tabella/CSV completo con schema e riconciliazione dei totali.",
  aliases: ["fatturapa csv", "fatture elettroniche batch", "xml fatture in tabella"],
  keywords: ["FatturaPA", "CSV", "batch", "XML", "fatture elettroniche"],
  jobs: ["convertire più FatturePA in CSV", "isolare file FatturaPA malformati", "confrontare totale documento e totale rappresentato"],
  category: "data",
  inputTypes: ["file", "xml", "table"],
  packIds: [],
  roleTags: [],
  implementation: "../tools/fatturapa-batch-csv/module.ts",
  engine: "table-csv",
  runtime: { location: "LOCAL", network: "forbidden" },
  privacyClass: "LOCAL",
  capabilities: ["file-read", "file-write"],
  profileFields: [],
  handoff: { emits: [{ type: "table", format: "csv", maxBytes: 26214400, requiresUniqueHeaders: true, acceptsRaggedRows: false }] },
  result: { class: "batch", capabilities: ["download", "reset", "batch", "provenance"] },
  gold: { maintenanceClass: "R", oracleEntryId: "cand-259", fixtureFamilies: ["italy-2026-consumers"] },
  version: "1.0.0",
  deterministic: true,
  dependencies: [],
  lazyDependencies: [],
  bundle: { eager: false, lazy: true, initialBytes: 0, maxBytes: 350000 },
  offline: "FULL",
  acceptance: { independentOracle: true, fixtureFamilies: ["italy-2026-consumers"], privacy: true, accessibility: true, bundle: true },
  page: { component: "FatturaPaBatchCsvTool", clientDirective: "load" },
} as const satisfies FactoryToolManifest;

export default fatturaPaBatchCsvManifest;
