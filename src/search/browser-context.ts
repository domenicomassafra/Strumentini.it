import type { SearchContext } from "./types";

export const SEARCH_CONTEXT_EVENT = "utilityos:search-context";

export function publishSearchContext(context: SearchContext): void {
  window.dispatchEvent(new CustomEvent<SearchContext>(SEARCH_CONTEXT_EVENT, { detail: context }));
}

export function subscribeSearchContext(listener: (context: SearchContext) => void): () => void {
  const handler = (event: Event): void => listener((event as CustomEvent<SearchContext>).detail);
  window.addEventListener(SEARCH_CONTEXT_EVENT, handler);
  return () => window.removeEventListener(SEARCH_CONTEXT_EVENT, handler);
}
