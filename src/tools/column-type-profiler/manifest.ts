import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const columnTypeProfilerManifest = makeTableManifest({
  id: "column-type-profiler",
  name: "Column Type Profiler",
  summary: "Infer bounded string, number, boolean, and date types per column and flag mixed values.",
  aliases: ["profile csv column types", "infer table types", "column data profiler"],
  keywords: ["csv", "types", "profile", "schema", "inference"],
  jobs: ["profile csv column types", "infer table value types", "check mixed columns"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-038", fixtureFamilies: ["csv-table-ops", "data-table-gold"] },
  handoff: tableHandoff(),
  component: "ColumnTypeProfilerTool",
});

export default columnTypeProfilerManifest;
