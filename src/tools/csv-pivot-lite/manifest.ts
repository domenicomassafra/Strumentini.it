import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const csvPivotLiteManifest = makeTableManifest({
  id: "csv-pivot-lite",
  name: "CSV Pivot Lite",
  summary: "Create a small local pivot table by grouping rows and aggregating one value column.",
  aliases: ["pivot csv", "csv pivot table", "pivot lite table"],
  keywords: ["csv", "pivot", "aggregate", "group"],
  jobs: ["pivot a csv table", "aggregate values by group", "make a small pivot"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-032", fixtureFamilies: ["csv-rfc4180", "csv-table-ops"] },
  handoff: tableHandoff(),
  component: "CsvPivotLiteTool",
});

export default csvPivotLiteManifest;
