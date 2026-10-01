import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const csvJoinManifest = makeTableManifest({
  id: "csv-join",
  name: "CSV Join",
  summary: "Join two bounded CSV tables on explicit key-column positions with inner, left, right, and full modes.",
  aliases: ["join csv", "csv table join", "merge csv tables"],
  keywords: ["csv", "join", "merge", "keys", "lookup"],
  jobs: ["join two csv tables", "lookup rows across csv files", "merge tables by key"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-031", fixtureFamilies: ["csv-rfc4180", "csv-table-ops", "data-table-gold"] },
  handoff: tableHandoff(),
  component: "CsvJoinTool",
});

export default csvJoinManifest;
