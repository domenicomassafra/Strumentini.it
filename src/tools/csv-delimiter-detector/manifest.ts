import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const csvDelimiterDetectorManifest = makeTableManifest({
  id: "csv-delimiter-detector",
  name: "CSV Delimiter Detector",
  summary: "Compare comma, semicolon, tab, and pipe candidates using quoted-field-aware local evidence.",
  aliases: ["detect csv delimiter", "csv separator detector", "find csv separator"],
  keywords: ["csv", "delimiter", "separator", "semicolon", "tab"],
  jobs: ["detect a csv delimiter", "identify a separator", "inspect csv field counts"],
  inputTypes: ["text", "csv", "file"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-023", fixtureFamilies: ["csv-cleaning", "csv-rfc4180"] },
  handoff: tableHandoff(),
  component: "CsvDelimiterDetectorTool",
});

export default csvDelimiterDetectorManifest;
