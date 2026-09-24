import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const missingValueProfilerManifest = makeTableManifest({
  id: "missing-value-profiler",
  name: "Missing-Value Profiler",
  summary: "Profile empty cells by column with bounded counts, rates, and total missing-value counts.",
  aliases: ["profile missing csv values", "csv missing data", "empty cell profiler"],
  keywords: ["csv", "missing", "null", "profile", "quality"],
  jobs: ["profile missing csv values", "count empty table cells", "inspect column completeness"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-037", fixtureFamilies: ["csv-table-ops"] },
  handoff: tableHandoff(),
  component: "MissingValueProfilerTool",
});

export default missingValueProfilerManifest;
