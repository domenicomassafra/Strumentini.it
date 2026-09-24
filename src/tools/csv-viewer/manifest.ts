import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const csvViewerManifest = makeTableManifest({
  id: "csv-viewer",
  name: "CSV Viewer",
  summary: "Preview a bounded CSV table with detected shape, delimiter, warnings, and the first rows without uploading it.",
  aliases: ["view csv", "csv table viewer", "preview csv"],
  keywords: ["csv", "table", "preview", "rows"],
  jobs: ["preview a csv table", "inspect csv rows", "view a local csv file"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-021", fixtureFamilies: ["csv-rfc4180"] },
  handoff: tableHandoff(),
  component: "CsvViewerTool",
});

export default csvViewerManifest;
