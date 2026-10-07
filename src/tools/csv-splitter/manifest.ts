import { makeTableManifest } from "../table/manifest-factory";

export const csvSplitterManifest = makeTableManifest({
  id: "csv-splitter",
  name: "CSV Splitter",
  summary: "Split a large local CSV by row count or approximate byte target while repeating its header and preserving CSV dialect.",
  aliases: ["split csv", "large csv splitter", "chunk csv"],
  keywords: ["csv", "split", "chunk", "large file", "header", "streaming"],
  jobs: ["split a large CSV", "chunk CSV by rows", "chunk CSV by output size"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-229", fixtureFamilies: ["csv-rfc4180", "csv-advanced-ops"] },
  handoff: {
    accepts: [{ type: "table", format: "csv", maxBytes: 50 * 1024 * 1024, requiresUniqueHeaders: false, acceptsRaggedRows: true }],
    emits: [{ type: "table", format: "csv" }],
  },
  component: "CsvSplitterTool",
});

export default csvSplitterManifest;
