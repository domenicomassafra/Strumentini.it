import { makeTableManifest } from "../table/manifest-factory";

export const csvToJsonManifest = makeTableManifest({
  id: "csv-to-json",
  name: "CSV to JSON",
  summary: "Convert a bounded CSV table to JSON records with explicit duplicate-header and missing-cell policy.",
  aliases: ["csv to json", "convert csv records", "csv json converter"],
  keywords: ["csv", "json", "records", "convert"],
  jobs: ["convert csv to json", "export csv records as json", "turn a table into json"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-033", fixtureFamilies: ["json-csv-conversion", "csv-rfc4180", "data-table-gold"] },
  handoff: { accepts: [{ type: "table" as const, format: "csv" as const, maxBytes: 10 * 1024 * 1024, requiresUniqueHeaders: false, acceptsRaggedRows: true }], emits: [{ type: "structured" as const, format: "json" as const }] },
  component: "CsvToJsonTool",
});

export default csvToJsonManifest;
