import type { ToolManifest } from "../../catalog/manifest";

export const csvDedupeManifest = {
  id: "csv-dedupe",
  route: "/tools/csv-dedupe",
  name: "CSV Dedupe",
  summary: "Remove duplicate CSV rows by whole-row equality or explicit key columns while keeping the first occurrence stable.",
  aliases: ["csv deduplicator", "remove duplicate csv rows", "dedupe table"],
  jobs: ["remove duplicate rows", "dedupe csv by key", "keep first csv row per key"],
  category: "data",
  inputTypes: ["file", "csv", "table"],
  implementation: "../tools/csv-dedupe/module.ts",
  engine: "table-csv",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: {
    accepts: [{ type: "table", format: "csv", maxBytes: 10 * 1024 * 1024, acceptsRaggedRows: true }],
    emits: [{ type: "table", format: "csv" }],
  },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-025", fixtureFamilies: ["csv-rfc4180", "csv-table-ops"] },
} as const satisfies ToolManifest;

export default csvDedupeManifest;
