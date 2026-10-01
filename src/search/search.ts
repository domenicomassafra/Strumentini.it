import { createSearchIndex, searchCatalog, suggestCloseIntents } from "./catalog-search";
import type { SearchBucket, SearchContext, SearchTier, SearchToolMetadata } from "./types";

export type SearchSectionId = "your-tools" | "recent" | "library";
export type SearchMatch = "exact" | "intent" | "recent" | "pack" | "catalog";

export interface SearchHit extends SearchToolMetadata {
  section: SearchSectionId;
  match: SearchMatch;
  score: number;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  sections: Array<{ id: SearchSectionId; label: "I tuoi strumenti" | "Recenti" | "Libreria"; hits: SearchHit[] }>;
  closeIntents: string[];
}

const bucketToSection: Record<SearchBucket, SearchSectionId> = {
  "I tuoi strumenti": "your-tools",
  Recenti: "recent",
  Libreria: "library",
};

const tierToMatch: Record<SearchTier, SearchMatch> = {
  "exact-installed": "exact",
  "task-intent": "intent",
  recent: "recent",
  "pack-relevance": "pack",
  catalog: "catalog",
};

const sectionOrder = [
  ["your-tools", "I tuoi strumenti"],
  ["recent", "Recenti"],
  ["library", "Libreria"],
] as const;

export function createSearch(tools: readonly SearchToolMetadata[]) {
  const index = createSearchIndex(tools);

  return {
    query(rawQuery: string, context: SearchContext = {}, limit = 50): SearchResult {
      const hits = searchCatalog(rawQuery, index, context, limit).map(({ tool, tier, bucket, score }): SearchHit => ({
        id: tool.id,
        route: tool.route,
        name: tool.name,
        summary: tool.summary,
        aliases: tool.aliases,
        jobs: tool.jobs,
        category: tool.category,
        inputTypes: tool.inputTypes,
        ...(tool.engine === undefined ? {} : { engine: tool.engine }),
        runtime: tool.runtime,
        ...(tool.packTags === undefined ? {} : { packTags: tool.packTags }),
        ...(tool.roleTags === undefined ? {} : { roleTags: tool.roleTags }),
        section: bucketToSection[bucket],
        match: tierToMatch[tier],
        score,
      }));

      return {
        query: rawQuery,
        hits,
        sections: sectionOrder.map(([id, label]) => ({ id, label, hits: hits.filter((hit) => hit.section === id) })),
        closeIntents: hits.length === 0 ? suggestCloseIntents(rawQuery, index, 4) : [],
      };
    },
  };
}
