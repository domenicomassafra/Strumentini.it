import type { ToolSummary } from "./manifest";
import { groupForCategory } from "./groups";

/** Serialized route metadata consumed by the directory's URL-driven filters. */
export function directoryMetaJson(tools: readonly ToolSummary[], verifiedIds: ReadonlySet<string>): string {
  const meta: Record<string, [string, string, string, string]> = {};
  for (const tool of tools) {
    meta[tool.route] = [
      tool.category,
      groupForCategory(tool.category).slug,
      tool.inputTypes.join(" "),
      verifiedIds.has(tool.id) ? "verificato" : "verifica",
    ];
  }
  return JSON.stringify(meta).replace(/</gu, "\\u003c");
}
