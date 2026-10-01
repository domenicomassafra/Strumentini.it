import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const tableTransposeManifest = makeTableManifest({
  id: "table-transpose",
  name: "Table Transpose",
  summary: "Transpose a bounded table so source columns become output rows while preserving cell text.",
  aliases: ["transpose table", "transpose csv", "flip csv rows and columns"],
  keywords: ["table", "transpose", "csv", "flip"],
  jobs: ["transpose a csv table", "flip table rows and columns", "rotate a table"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-036", fixtureFamilies: ["csv-table-ops", "csv-rfc4180", "data-table-gold"] },
  handoff: tableHandoff(),
  component: "TableTransposeTool",
});

export default tableTransposeManifest;
