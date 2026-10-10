import type { RecentToolActivity } from "../../workbench/state";

/** #345 — Navigation state is IDs and timestamps only, never last input/output. */
export interface RecentCatalogLink345 {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly category: string;
  readonly route: string;
}

export interface HomeRecentLink345 extends RecentCatalogLink345 {
  readonly lastUsedAt: string;
  readonly useCount: number;
}

const SAFE_TOOL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * Fresh navigable links must be sourced from the current catalog, not from
 * untrusted device storage. The device supplies only a bounded tool identifier.
 * No values, filenames, bytes, query parameters or blobs can enter the URL.
 */
export function selectHomeRecent345(
  recent: readonly RecentToolActivity[],
  catalog: readonly RecentCatalogLink345[],
  limit = 4,
): HomeRecentLink345[] {
  const byId = new Map(catalog.filter((tool) => SAFE_TOOL.test(tool.id) && tool.route === `/tools/${tool.id}`)
    .map((tool) => [tool.id, tool]));
  const seen = new Set<string>();
  const candidates: HomeRecentLink345[] = [];
  for (const item of recent.slice(0, 12)) {
    if (!SAFE_TOOL.test(item.toolId) || seen.has(item.toolId)) continue;
    seen.add(item.toolId);
    const tool = byId.get(item.toolId);
    const at = Date.parse(item.lastUsedAt);
    if (tool === undefined || !Number.isFinite(at) || !Number.isSafeInteger(item.useCount) || item.useCount <= 0) continue;
    candidates.push({ ...tool, lastUsedAt: item.lastUsedAt, useCount: item.useCount });
  }
  return candidates
    .sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt))
    .slice(0, Math.max(0, Math.min(4, Math.floor(limit))));
}
