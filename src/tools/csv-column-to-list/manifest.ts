import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const csvColumnToListManifest = {
  id: "csv-column-to-list",
  route: "/tools/csv-column-to-list",
  name: "CSV Column to List",
  summary: "Extract one named or numbered CSV column into a newline-separated list with quoting preserved.",
  aliases: ["csv column extractor", "csv to list", "extract csv column"],
  jobs: ["extract a csv column", "convert csv column to list", "copy csv values"],
  category: "text",
  inputTypes: ["csv", "text", "list"],
  implementation: "../tools/csv-column-to-list/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["csv-column-to-list"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-018", fixtureFamilies: ["csv-rfc4180", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default csvColumnToListManifest;
