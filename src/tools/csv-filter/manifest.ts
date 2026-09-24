import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const csvFilterManifest = makeTableManifest({
  id: "csv-filter",
  name: "CSV Filter",
  summary: "Filter rows with explicit column, comparison, case-sensitivity, and empty-value rules.",
  aliases: ["filter csv", "csv row filter", "filter table rows"],
  keywords: ["csv", "filter", "rows", "search"],
  jobs: ["filter csv rows", "find rows containing text", "filter empty csv values"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-028", fixtureFamilies: ["csv-rfc4180", "csv-table-ops"] },
  handoff: tableHandoff(),
  component: "CsvFilterTool",
});

export default csvFilterManifest;
