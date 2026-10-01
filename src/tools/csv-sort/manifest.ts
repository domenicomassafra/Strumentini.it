import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const csvSortManifest = makeTableManifest({
  id: "csv-sort",
  name: "CSV Sort",
  summary: "Sort a bounded CSV table by lexical, numeric, or date values with stable tie order and explicit empty placement.",
  aliases: ["sort csv", "sort table rows", "csv order rows"],
  keywords: ["csv", "sort", "order", "numeric", "date"],
  jobs: ["sort csv rows", "order a csv table", "sort values numerically"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-029", fixtureFamilies: ["csv-rfc4180", "csv-table-ops", "data-table-gold"] },
  handoff: tableHandoff(),
  component: "CsvSortTool",
});

export default csvSortManifest;
