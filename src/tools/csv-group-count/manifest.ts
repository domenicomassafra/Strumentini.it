import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const csvGroupCountManifest = makeTableManifest({
  id: "csv-group-count",
  name: "CSV Group & Count",
  summary: "Group rows by explicit columns and emit stable counts or numeric aggregates as CSV.",
  aliases: ["group and count csv", "csv group by", "count rows by column"],
  keywords: ["csv", "group", "count", "aggregate"],
  jobs: ["count rows by group", "aggregate csv rows", "group a table locally"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-030", fixtureFamilies: ["csv-rfc4180", "csv-table-ops", "data-table-gold"] },
  handoff: tableHandoff(),
  component: "CsvGroupCountTool",
});

export default csvGroupCountManifest;
