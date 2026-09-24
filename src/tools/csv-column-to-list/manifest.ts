import type { ToolManifest } from "../../catalog/manifest";

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
  gold: { maintenanceClass: "E", oracleEntryId: "cand-018", fixtureFamilies: ["csv-rfc4180"] },
} as const satisfies ToolManifest;

export default csvColumnToListManifest;
