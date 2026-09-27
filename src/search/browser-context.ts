import type { SearchContext } from "./types";

export const SEARCH_CONTEXT_EVENT = "strumentiutili:search-context";
const MAX_CONTEXT_IDS = 500;
const CONTEXT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;

function boundedIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.slice(0, MAX_CONTEXT_IDS).filter((item): item is string => typeof item === "string" && CONTEXT_ID_PATTERN.test(item));
  return [...new Set(ids)];
}

export function sanitizeSearchContext(value: unknown): SearchContext {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const installedToolIds = boundedIds(source.installedToolIds);
  const recentToolIds = boundedIds(source.recentToolIds);
  const installedPackTags = boundedIds(source.installedPackTags);
  return {
    ...(installedToolIds === undefined ? {} : { installedToolIds }),
    ...(recentToolIds === undefined ? {} : { recentToolIds }),
    ...(installedPackTags === undefined ? {} : { installedPackTags }),
  };
}

export function publishSearchContext(context: SearchContext): void {
  window.dispatchEvent(new CustomEvent<SearchContext>(SEARCH_CONTEXT_EVENT, { detail: sanitizeSearchContext(context) }));
}

export function subscribeSearchContext(listener: (context: SearchContext) => void): () => void {
  const handler = (event: Event): void => listener(sanitizeSearchContext((event as CustomEvent<SearchContext>).detail));
  window.addEventListener(SEARCH_CONTEXT_EVENT, handler);
  return () => window.removeEventListener(SEARCH_CONTEXT_EVENT, handler);
}
