import type {
  RankedToolHit,
  SearchContext,
  SearchIndexEntry,
  SearchTier,
  SearchToolMetadata,
} from "./types";
import { categoryLabelIt, inputTypeLabelIt, tagLabelIt } from "../i18n/it/taxonomy";

const normalize = (value: string): string => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/gu, "")
  .toLocaleLowerCase("it-IT")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const normalizedList = (values: readonly string[] | undefined): string[] =>
  (values ?? []).map(normalize).filter(Boolean);

export function createSearchIndex(tools: readonly SearchToolMetadata[]): readonly SearchIndexEntry[] {
  return tools.map((tool) => {
    const normalized = {
      id: normalize(tool.id),
      name: normalize(tool.name),
      summary: normalize(tool.summary),
      aliases: normalizedList(tool.aliases),
      jobs: normalizedList(tool.jobs),
      category: normalize(`${tool.category} ${categoryLabelIt(tool.category)}`),
      inputTypes: tool.inputTypes.map((value) => normalize(`${value} ${inputTypeLabelIt(value)}`)),
      packTags: [...new Set((tool.packTags ?? []).flatMap((value) => [normalize(value), normalize(tagLabelIt(value))]))],
      roleTags: [...new Set((tool.roleTags ?? []).flatMap((value) => [normalize(value), normalize(tagLabelIt(value))]))],
      runtime: [normalize(tool.runtime.location), normalize(tool.runtime.network)],
      all: "",
    };
    normalized.all = [
      normalized.id,
      normalized.name,
      normalized.summary,
      ...normalized.aliases,
      ...normalized.jobs,
      normalized.category,
      ...normalized.inputTypes,
      ...normalized.packTags,
      ...normalized.roleTags,
      ...normalized.runtime,
    ].join(" ");

    return {
      id: tool.id,
      route: tool.route,
      name: tool.name,
      summary: tool.summary,
      aliases: [...tool.aliases],
      jobs: [...tool.jobs],
      category: tool.category,
      inputTypes: [...tool.inputTypes],
      ...(tool.engine === undefined ? {} : { engine: tool.engine }),
      runtime: { ...tool.runtime },
      ...(tool.packTags === undefined ? {} : { packTags: [...tool.packTags] }),
      ...(tool.roleTags === undefined ? {} : { roleTags: [...tool.roleTags] }),
      ...(tool.quality === undefined ? {} : { quality: tool.quality }),
      normalized,
    } satisfies SearchIndexEntry;
  });
}

const phraseMatches = (phrase: string, query: string, tokens: readonly string[]): boolean =>
  phrase === query || phrase.includes(query) || tokens.every((token) => phrase.includes(token));

function matchScore(entry: SearchIndexEntry, query: string, tokens: readonly string[]): number {
  if (query === "") return 1;
  const directPhraseMatch = entry.normalized.name.includes(query)
    || entry.normalized.aliases.some((value) => value.includes(query))
    || entry.normalized.jobs.some((value) => value.includes(query))
    || entry.normalized.category.includes(query)
    || entry.normalized.inputTypes.some((value) => value.includes(query))
    || entry.normalized.roleTags.some((value) => value.includes(query))
    || entry.normalized.packTags.some((value) => value.includes(query))
    || entry.normalized.runtime.some((value) => value.includes(query))
    || entry.normalized.summary.includes(query);
  if (!directPhraseMatch && !tokens.every((token) => entry.normalized.all.includes(token))) return 0;
  let score = 0;
  if (entry.normalized.name === query) score += 100;
  else if (entry.normalized.name.startsWith(query)) score += 72;
  else if (entry.normalized.name.includes(query)) score += 60;

  if (entry.normalized.aliases.some((value) => value === query)) score += 95;
  else if (entry.normalized.aliases.some((value) => phraseMatches(value, query, tokens))) score += 70;
  if (entry.normalized.jobs.some((value) => value === query)) score += 92;
  else if (entry.normalized.jobs.some((value) => phraseMatches(value, query, tokens))) score += 76;

  if (entry.normalized.category.includes(query)) score += 34;
  if (entry.normalized.inputTypes.some((value) => phraseMatches(value, query, tokens))) score += 30;
  if (entry.normalized.roleTags.some((value) => phraseMatches(value, query, tokens))) score += 28;
  if (entry.normalized.packTags.some((value) => phraseMatches(value, query, tokens))) score += 28;
  if (entry.normalized.runtime.some((value) => phraseMatches(value, query, tokens))) score += 18;
  if (entry.normalized.summary.includes(query)) score += 16;

  for (const token of tokens) {
    if (entry.normalized.all.includes(token)) score += 4;
  }
  return score;
}

function classifyTier(
  entry: SearchIndexEntry,
  query: string,
  tokens: readonly string[],
  context: SearchContext,
): SearchTier {
  const installed = new Set(context.installedToolIds ?? []);
  const recent = new Set(context.recentToolIds ?? []);
  const installedPackTags = new Set(normalizedList(context.installedPackTags));
  const exactIdentity = entry.normalized.name === query
    || entry.normalized.id === query
    || entry.normalized.aliases.includes(query);
  if (query !== "" && installed.has(entry.id) && exactIdentity) return "exact-installed";

  const strongTaskIntent = query !== "" && (
    exactIdentity
    || entry.normalized.jobs.some((value) => phraseMatches(value, query, tokens))
    || entry.normalized.aliases.some((value) => phraseMatches(value, query, tokens))
  );
  if (strongTaskIntent) return "task-intent";
  if (recent.has(entry.id)) return "recent";
  if (entry.normalized.packTags.some((tag) => installedPackTags.has(tag))) return "pack-relevance";
  return "catalog";
}

const tierWeight: Record<SearchTier, number> = {
  "exact-installed": 500,
  "task-intent": 400,
  recent: 300,
  "pack-relevance": 200,
  catalog: 100,
};

export function searchCatalog(
  rawQuery: string,
  index: readonly SearchIndexEntry[],
  context: SearchContext = {},
  limit = 50,
): RankedToolHit[] {
  const query = normalize(rawQuery);
  const tokens = query === "" ? [] : query.split(" ");
  const installed = new Set(context.installedToolIds ?? []);
  const recent = new Set(context.recentToolIds ?? []);

  return index
    .map((entry): RankedToolHit | null => {
      const relevance = matchScore(entry, query, tokens);
      if (query !== "" && relevance === 0) return null;
      const tier = classifyTier(entry, query, tokens, context);
      const bucket = installed.has(entry.id) ? "I tuoi strumenti" : recent.has(entry.id) ? "Recenti" : "Libreria";
      return { tool: entry, tier, bucket, score: tierWeight[tier] + relevance };
    })
    .filter((hit): hit is RankedToolHit => hit !== null)
    .sort((left, right) => right.score - left.score
      || left.tool.name.localeCompare(right.tool.name)
      || left.tool.id.localeCompare(right.tool.id))
    .slice(0, Math.max(0, limit));
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = (previous[rightIndex - 1] ?? 0) + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        substitution,
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? Math.max(left.length, right.length);
}

export function suggestCloseIntents(
  rawQuery: string,
  index: readonly SearchIndexEntry[],
  limit = 4,
): string[] {
  const query = normalize(rawQuery);
  if (query.length < 3) return [];

  const candidates = new Map<string, { label: string; distance: number; ratio: number }>();
  for (const entry of index) {
    for (const label of [...entry.aliases, ...entry.jobs, entry.name]) {
      const normalized = normalize(label);
      if (normalized === "" || normalized === query) continue;
      const distance = editDistance(query, normalized);
      const ratio = distance / Math.max(query.length, normalized.length);
      if (ratio > 0.24) continue;
      const existing = candidates.get(normalized);
      if (existing === undefined || distance < existing.distance) {
        candidates.set(normalized, { label, distance, ratio });
      }
    }
  }

  return [...candidates.values()]
    .sort((left, right) => left.ratio - right.ratio || left.distance - right.distance || left.label.localeCompare(right.label))
    .slice(0, Math.max(0, limit))
    .map(({ label }) => label);
}
