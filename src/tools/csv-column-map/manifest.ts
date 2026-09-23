import type { ToolManifest } from "../../catalog/manifest";

export const csvColumnMapManifest = {
  id: "csv-column-map",
  route: "/tools/csv-column-map",
  name: "CSV Column Map / Reorder",
  summary: "Select, rename, and reorder CSV columns by explicit source index with a schema preview before output.",
  aliases: ["csv column selector", "csv reorder columns", "csv rename columns"],
  jobs: ["reorder csv columns", "rename csv columns", "select csv columns"],
  category: "data",
  inputTypes: ["file", "csv", "table"],
  implementation: "../tools/csv-column-map/module.ts",
  engine: "table-csv",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: {
    accepts: [{ type: "table", format: "csv", maxBytes: 10 * 1024 * 1024, acceptsRaggedRows: true }],
    emits: [{ type: "table", format: "csv" }],
  },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-027", fixtureFamilies: ["csv-rfc4180", "csv-table-ops"] },
} as const satisfies ToolManifest;

export default csvColumnMapManifest;
