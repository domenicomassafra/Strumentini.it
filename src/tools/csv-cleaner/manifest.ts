import type { ToolManifest } from "../../catalog/manifest";

export const csvCleanerManifest = {
  id: "csv-cleaner",
  route: "/tools/csv-cleaner",
  name: "CSV Cleaner",
  summary: "Inspect and safely normalize CSV record line endings and UTF-8 BOM without uploading the file.",
  aliases: ["clean csv", "csv normalizer", "csv inspector"],
  jobs: ["clean csv file", "inspect csv warnings", "normalize csv line endings"],
  category: "data",
  inputTypes: ["file", "csv"],
  implementation: "../tools/csv-cleaner/module.ts",
  engine: "table-csv",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: {
    emits: [{ type: "table", format: "csv" }],
  },
  result: { class: "table", capabilities: ["copy", "download", "handoff", "reset"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-022", fixtureFamilies: ["csv-rfc4180", "csv-cleaning"] },
} as const satisfies ToolManifest;

export default csvCleanerManifest;
