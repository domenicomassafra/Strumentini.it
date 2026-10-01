import type { ToolManifest } from "../../catalog/manifest";

export const textToCsvRowsManifest = {
  id: "text-to-csv-rows",
  route: "/tools/text-to-csv-rows",
  name: "Text to CSV Rows",
  summary: "Turn delimited text lines into escaped CSV rows with generated or explicit headers.",
  aliases: ["text to csv", "lines to csv", "make csv rows"],
  jobs: ["convert text to csv", "turn lines into rows", "create csv records"],
  category: "text",
  inputTypes: ["text", "list", "csv"],
  implementation: "../tools/text-to-csv-rows/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-017", fixtureFamilies: ["csv-rfc4180", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default textToCsvRowsManifest;
