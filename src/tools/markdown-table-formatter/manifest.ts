import type { ToolManifest } from "../../catalog/manifest";

export const markdownTableFormatterManifest = {
  id: "markdown-table-formatter",
  route: "/tools/markdown-table-formatter",
  name: "Markdown Table Formatter",
  summary: "Align Markdown pipe-table headers, separators, and rows while preserving cell content.",
  aliases: ["format markdown table", "align markdown table", "pipe table formatter"],
  jobs: ["format markdown tables", "align table columns", "normalize markdown syntax"],
  category: "text",
  inputTypes: ["text", "markdown"],
  implementation: "../tools/markdown-table-formatter/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "D", oracleEntryId: "cand-015", fixtureFamilies: ["csv-rfc4180"] },
} as const satisfies ToolManifest;

export default markdownTableFormatterManifest;
