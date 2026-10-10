import type { RecentToolActivity } from "./state";

export interface ExplainableTool344 {
  readonly id: string;
  readonly name: string;
  readonly route: string;
  readonly category: string;
}

export interface ExplainableSuggestion344<T extends ExplainableTool344> {
  readonly tool: T;
  /** A fact about successful use in THIS browser, not a popularity claim. */
  readonly reason: string;
}

const TOOL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CATEGORY_ID = /^[a-z0-9]+(?:-[a-z0-9-]+)*$/u;

/**
 * Ticket #344: local, bounded and fully explainable suggestions.
 *
 * A suggestion needs actual successful operation metadata from #330. We never
 * infer popularity from catalog order, favorites alone, visits, demographics,
 * location or server-side profiles. No use => no personalized ranking.
 */
export function explainableSuggestions344<T extends ExplainableTool344>(
  installedIds: readonly string[],
  recent: readonly RecentToolActivity[],
  catalog: readonly T[],
  limit = 4,
): readonly ExplainableSuggestion344<T>[] {
  const byId = new Map<string, T>();
  for (const tool of catalog) {
    if (!TOOL_ID.test(tool.id) || !CATEGORY_ID.test(tool.category) ||
      tool.route !== `/tools/${tool.id}` || !tool.name.trim() || byId.has(tool.id)) continue;
    byId.set(tool.id, tool);
  }
  const byCategory = new Map<string, { completed: number; latest: number }>();
  const seen = new Set<string>();
  for (const item of recent.slice(0, 12)) {
    if (!TOOL_ID.test(item.toolId) || seen.has(item.toolId)) continue;
    seen.add(item.toolId);
    const tool = byId.get(item.toolId);
    const timestamp = Date.parse(item.lastUsedAt);
    if (!tool || !Number.isFinite(timestamp) || !Number.isSafeInteger(item.useCount) || item.useCount < 1 || item.useCount > 1_000_000_000) continue;
    const current = byCategory.get(tool.category) ?? { completed: 0, latest: 0 };
    byCategory.set(tool.category, {
      completed: Math.min(1_000_000_000, current.completed + item.useCount),
      latest: Math.max(current.latest, timestamp),
    });
  }
  if (byCategory.size === 0) return [];
  const installed = new Set(installedIds);
  const count = Number.isFinite(limit) ? Math.max(0, Math.min(4, Math.floor(limit))) : 0;
  return [...byId.values()]
    // A completed tool is already known to the user: recommend other tools,
    // not the exact activity that supplied our evidence.
    .filter((tool) => !installed.has(tool.id) && !seen.has(tool.id) && byCategory.has(tool.category))
    .sort((left, right) => {
      const a = byCategory.get(left.category)!;
      const b = byCategory.get(right.category)!;
      return b.completed - a.completed || b.latest - a.latest || left.name.localeCompare(right.name, "it") || left.id.localeCompare(right.id);
    })
    .slice(0, count)
    .map((tool) => {
      const completed = byCategory.get(tool.category)!.completed;
      return {
        tool,
        reason: completed === 1
          ? "Perché hai completato 1 operazione in questa categoria su questo dispositivo."
          : `Perché hai completato ${completed} operazioni in questa categoria su questo dispositivo.`,
      };
    });
}
