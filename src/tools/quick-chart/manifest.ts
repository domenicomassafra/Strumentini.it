import { makeTableManifest, tableHandoff } from "../table/manifest-factory";

export const quickChartManifest = makeTableManifest({
  id: "quick-chart",
  name: "Quick Chart From Table",
  summary: "Create a bounded local bar chart from a label column and optional numeric value column.",
  aliases: ["chart from csv", "quick csv chart", "table bar chart"],
  keywords: ["chart", "csv", "bar", "table", "local"],
  jobs: ["chart csv values", "make a bar chart from a table", "summarize table values visually"],
  inputTypes: ["file", "csv", "table"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-040", fixtureFamilies: ["csv-table-ops"] },
  handoff: tableHandoff(),
  component: "QuickChartTool",
});

export default quickChartManifest;
