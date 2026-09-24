import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const csvColumnSelectorManifest = makeTableManifest({
  id: "csv-column-selector",
  name: "CSV Column Selector",
  summary: "Select and reorder CSV columns by zero-based position while preserving row values and reporting dropped columns.",
  aliases: ["select csv columns", "choose csv fields", "csv column picker"],
  keywords: ["csv", "columns", "select", "reorder"],
  jobs: ["select and keep csv columns", "keep chosen csv fields", "reorder table columns"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-026", fixtureFamilies: ["csv-table-ops", "csv-rfc4180"] },
  handoff: tableHandoff(),
  component: "CsvColumnSelectorTool",
});

export default csvColumnSelectorManifest;
