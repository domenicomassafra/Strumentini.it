import type { ToolManifest } from "../../catalog/manifest";

export const urlComparisonManifest = {
  id: "url-comparison",
  route: "/tools/url-comparison",
  name: "URL Comparison",
  summary: "Compare two URLs component by component with an explicit exact or semantic mode.",
  aliases: ["compare urls", "url difference checker"],
  jobs: ["compare two links", "find url component differences"],
  category: "web-operations",
  inputTypes: ["url", "text"],
  implementation: "../tools/url-comparison/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "validator", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-064", fixtureFamilies: ["query-params", "url-security"] },
} as const satisfies ToolManifest;

export default urlComparisonManifest;
