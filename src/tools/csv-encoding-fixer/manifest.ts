import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const csvEncodingFixerManifest = makeTableManifest({
  id: "csv-encoding-fixer",
  name: "CSV Encoding Fixer",
  summary: "Decode common local text encodings, remove byte-order marks, and emit normalized UTF-8 CSV text.",
  aliases: ["fix csv encoding", "csv character encoding", "decode csv text"],
  keywords: ["csv", "encoding", "utf-8", "utf-16", "bom"],
  jobs: ["fix a csv encoding", "convert csv text to utf-8", "remove a csv bom"],
  inputTypes: ["file", "bytes", "csv"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-024", fixtureFamilies: ["csv-cleaning", "csv-rfc4180", "data-table-gold"] },
  handoff: tableHandoff(),
  component: "CsvEncodingFixerTool",
});

export default csvEncodingFixerManifest;
