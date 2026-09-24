import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const duplicateRowProfilerManifest = makeTableManifest({
  id: "duplicate-row-profiler",
  name: "Duplicate-Row Profiler",
  summary: "Report duplicate whole rows or explicit key groups with stable examples and exact duplicate counts.",
  aliases: ["profile duplicate csv rows", "find duplicate records", "csv duplicate report"],
  keywords: ["csv", "duplicates", "profile", "keys", "quality"],
  jobs: ["profile duplicate csv rows", "find repeated table records", "count duplicate keys"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-039", fixtureFamilies: ["csv-table-ops"] },
  handoff: tableHandoff(),
  component: "DuplicateRowProfilerTool",
});

export default duplicateRowProfilerManifest;
