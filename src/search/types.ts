export type SearchRuntimeLocation = "LOCAL" | "REFERENCE" | "REMOTE" | "AI";

export interface SearchToolMetadata {
  id: string;
  route: string;
  name: string;
  summary: string;
  aliases: readonly string[];
  jobs: readonly string[];
  category: string;
  inputTypes: readonly string[];
  engine?: string;
  runtime: {
    location: SearchRuntimeLocation;
    network: "forbidden" | "reference-only" | "required";
  };
  packTags?: readonly string[];
  roleTags?: readonly string[];
  quality?: "verified" | "checking";
}

export interface SearchContext {
  installedToolIds?: readonly string[];
  recentToolIds?: readonly string[];
  installedPackTags?: readonly string[];
}

export type SearchTier =
  | "exact-installed"
  | "task-intent"
  | "recent"
  | "pack-relevance"
  | "catalog";

export type SearchBucket = "I tuoi strumenti" | "Recenti" | "Libreria";

export interface SearchIndexEntry extends SearchToolMetadata {
  normalized: {
    id: string;
    name: string;
    summary: string;
    aliases: readonly string[];
    jobs: readonly string[];
    category: string;
    inputTypes: readonly string[];
    packTags: readonly string[];
    roleTags: readonly string[];
    runtime: readonly string[];
    all: string;
  };
}

export interface RankedToolHit {
  tool: SearchIndexEntry;
  tier: SearchTier;
  bucket: SearchBucket;
  score: number;
}
