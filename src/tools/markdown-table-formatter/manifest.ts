import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

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
  result: TEXT_RESULT_V2_DECLARATIONS["markdown-table-formatter"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-015", fixtureFamilies: ["csv-rfc4180", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default markdownTableFormatterManifest;
