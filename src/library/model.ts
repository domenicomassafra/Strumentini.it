import { createSearchIndex, searchCatalog } from "../search/catalog-search";
import type { SearchContext, SearchIndexEntry, SearchToolMetadata } from "../search/types";

export type RuntimeFilter = "any" | "local" | "network";
export type InstallStateFilter = "any" | "installed" | "not-installed";

export interface LibraryFilters {
  query?: string;
  category?: string;
  inputType?: string;
  packTag?: string;
  roleTag?: string;
  runtime?: RuntimeFilter;
  installState?: InstallStateFilter;
}

export interface LibraryFacets {
  categories: string[];
  inputTypes: string[];
  packTags: string[];
  roleTags: string[];
}

export interface LibraryPage<T> {
  items: T[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
}

const searchIndexCache = new WeakMap<object, readonly SearchIndexEntry[]>();

function searchIndexFor(tools: readonly SearchToolMetadata[]): readonly SearchIndexEntry[] {
  const cached = searchIndexCache.get(tools);
  if (cached !== undefined) return cached;
  const index = createSearchIndex(tools);
  searchIndexCache.set(tools, index);
  return index;
}

const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

export function getLibraryFacets(tools: readonly SearchToolMetadata[]): LibraryFacets {
  return {
    categories: sortedUnique(tools.map(({ category }) => category)),
    inputTypes: sortedUnique(tools.flatMap(({ inputTypes }) => [...inputTypes])),
    packTags: sortedUnique(tools.flatMap(({ packTags }) => [...(packTags ?? [])])),
    roleTags: sortedUnique(tools.flatMap(({ roleTags }) => [...(roleTags ?? [])])),
  };
}

export function filterLibrary(
  tools: readonly SearchToolMetadata[],
  filters: LibraryFilters,
  context: SearchContext = {},
): SearchToolMetadata[] {
  const installed = new Set(context.installedToolIds ?? []);
  const byQuery = filters.query?.trim()
    ? searchCatalog(filters.query, searchIndexFor(tools), context, tools.length).map(({ tool }) => tool)
    : [...tools];

  return byQuery.filter((tool) => {
    if (filters.category && tool.category !== filters.category) return false;
    if (filters.inputType && !tool.inputTypes.includes(filters.inputType)) return false;
    if (filters.packTag && !(tool.packTags ?? []).includes(filters.packTag)) return false;
    if (filters.roleTag && !(tool.roleTags ?? []).includes(filters.roleTag)) return false;
    if (filters.runtime === "local" && !(tool.runtime.location === "LOCAL" && tool.runtime.network === "forbidden")) return false;
    if (filters.runtime === "network" && tool.runtime.network === "forbidden") return false;
    if (filters.installState === "installed" && !installed.has(tool.id)) return false;
    if (filters.installState === "not-installed" && installed.has(tool.id)) return false;
    return true;
  });
}

export function paginateLibrary<T>(items: readonly T[], requestedPage: number, pageSize = 50): LibraryPage<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize));
  const page = Math.min(pageCount, Math.max(1, Math.floor(requestedPage) || 1));
  const start = (page - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    page,
    pageCount,
    pageSize: safePageSize,
    total: items.length,
  };
}
