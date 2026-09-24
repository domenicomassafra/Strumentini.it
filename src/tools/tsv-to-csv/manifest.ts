import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const tsvToCsvManifest = makeTableManifest({
  id: "tsv-to-csv",
  name: "TSV to CSV",
  summary: "Parse tab-separated values with quoted-field support and emit normalized comma-separated CSV.",
  aliases: ["tsv to csv", "tab separated converter", "convert tsv"],
  keywords: ["tsv", "csv", "tab", "delimiter"],
  jobs: ["convert tsv to csv", "turn tab separated data into csv", "export a tsv table"],
  inputTypes: ["file", "tsv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-035", fixtureFamilies: ["csv-rfc4180"] },
  handoff: tableHandoff(),
  component: "TsvToCsvTool",
});

export default tsvToCsvManifest;
