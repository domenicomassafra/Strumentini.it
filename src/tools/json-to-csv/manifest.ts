import { makeTableManifest } from "../table/manifest-factory";

export const jsonToCsvManifest = makeTableManifest({
  id: "json-to-csv",
  name: "JSON to CSV",
  summary: "Convert a JSON array of objects to bounded CSV with explicit first-record or union header policy.",
  aliases: ["json to csv", "convert json records", "json csv converter"],
  keywords: ["json", "csv", "records", "schema"],
  jobs: ["convert json to csv", "export json records as csv", "turn json objects into a table"],
  inputTypes: ["file", "json", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-034", fixtureFamilies: ["json-csv-conversion", "csv-rfc4180"] },
  handoff: { accepts: [{ type: "structured" as const, format: "json" as const, maxBytes: 10 * 1024 * 1024 }], emits: [{ type: "table" as const, format: "csv" as const }] },
  component: "JsonToCsvTool",
});

export default jsonToCsvManifest;
