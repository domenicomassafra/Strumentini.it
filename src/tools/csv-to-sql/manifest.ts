import { makeTableManifest } from "../table/manifest-factory";

export const csvToSqlManifest = makeTableManifest({
  id: "csv-to-sql",
  name: "CSV to SQL",
  summary: "Generate quoted PostgreSQL, MySQL, or SQLite schema and INSERT text from a local CSV without executing SQL.",
  aliases: ["csv sql", "csv to insert", "csv database import sql"],
  keywords: ["csv", "sql", "postgresql", "mysql", "sqlite", "insert", "schema"],
  jobs: ["generate SQL from CSV", "preview CSV INSERT statements", "create SQL schema from CSV"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-228", fixtureFamilies: ["csv-rfc4180", "csv-advanced-ops"] },
  handoff: { accepts: [{ type: "table", format: "csv", maxBytes: 10 * 1024 * 1024, requiresUniqueHeaders: true, acceptsRaggedRows: true }] },
  component: "CsvToSqlTool",
});

export default csvToSqlManifest;
