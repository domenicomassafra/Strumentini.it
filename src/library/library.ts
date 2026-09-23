import { filterLibrary as filterLibraryModel, paginateLibrary } from "./model";
import type { SearchContext, SearchToolMetadata } from "../search/types";

export type LibraryRuntime = "" | "LOCAL" | "NETWORK";
export type LibraryInstalled = "" | "installed" | "not-installed";

export interface LibraryState {
  q: string;
  category: string;
  tag: string;
  input: string;
  runtime: LibraryRuntime;
  installed: LibraryInstalled;
  page: number;
}

export const emptyLibraryState: LibraryState = {
  q: "",
  category: "",
  tag: "",
  input: "",
  runtime: "",
  installed: "",
  page: 1,
};

export function parseLibraryState(value: string | URLSearchParams): LibraryState {
  const params = typeof value === "string"
    ? new URLSearchParams(value.startsWith("?") ? value.slice(1) : value)
    : value;
  const rawPage = Number.parseInt(params.get("page") ?? "1", 10);
  const runtime = params.get("runtime");
  const installed = params.get("installed");
  return {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    tag: params.get("tag") ?? "",
    input: params.get("input") ?? "",
    runtime: runtime === "LOCAL" || runtime === "NETWORK" ? runtime : "",
    installed: installed === "installed" || installed === "not-installed" ? installed : "",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function serializeLibraryState(state: LibraryState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category) params.set("category", state.category);
  if (state.tag) params.set("tag", state.tag);
  if (state.input) params.set("input", state.input);
  if (state.runtime) params.set("runtime", state.runtime);
  if (state.installed) params.set("installed", state.installed);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function filterLibrary(
  tools: readonly SearchToolMetadata[],
  state: LibraryState,
  context: SearchContext = {},
): SearchToolMetadata[] {
  const filtered = filterLibraryModel(tools, {
    query: state.q,
    ...(state.category ? { category: state.category } : {}),
    ...(state.input ? { inputType: state.input } : {}),
    runtime: state.runtime === "LOCAL" ? "local" : state.runtime === "NETWORK" ? "network" : "any",
    installState: state.installed || "any",
  }, context);
  if (!state.tag) return filtered;
  return filtered.filter((tool) => (tool.packTags ?? []).includes(state.tag) || (tool.roleTags ?? []).includes(state.tag));
}

export function pageLibrary<T>(items: readonly T[], page: number, pageSize = 50) {
  const result = paginateLibrary(items, page, pageSize);
  return {
    items: result.items,
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.pageCount,
  };
}
