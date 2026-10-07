import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const tableCompareManifest = makeTableManifest({
  id: "table-compare",
  name: "Table Compare",
  summary: "Compare two local CSV tables by explicit key and value columns with duplicate-key, null, and case policies.",
  aliases: ["compare csv", "table diff", "csv diff by key"],
  keywords: ["csv", "table", "compare", "diff", "key", "changed cells"],
  jobs: ["compare two CSV tables", "find added removed and changed rows", "diff table cells by key"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-230", fixtureFamilies: ["csv-rfc4180", "csv-advanced-ops"] },
  handoff: tableHandoff(),
  component: "TableCompareTool",
});

export default tableCompareManifest;
