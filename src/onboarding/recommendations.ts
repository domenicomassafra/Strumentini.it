import type { ToolSummary } from "../catalog/manifest";
import { createSearchIndex, searchCatalog } from "../search/catalog-search";
import {
  getRecurringJob,
  getWorkContextPack,
  RECURRING_JOBS,
  WORK_CONTEXT_PACKS,
  type RecurringJobId,
  type WorkContextId,
} from "./contexts";
import { goldToolIds, type GoldQualityIndex } from "./quality";
import { contextTagsForTools, getContextMemberships } from "./membership";

export const MAX_STARTER_TOOLS = 15;
export const MIN_STARTER_TOOLS = 10;

export type StarterQuality = "gold" | "not-certified";
export type StarterReasonCode = "context-pack" | "recurring-job" | "universal" | "manual-add";

export interface StarterReason {
  readonly code: StarterReasonCode;
  readonly label: string;
  readonly evidence: readonly string[];
}

export interface StarterRecommendation {
  readonly tool: ToolSummary;
  readonly reason: string;
  readonly reasonCode: StarterReasonCode;
  readonly evidence: readonly string[];
  readonly quality: StarterQuality;
}

export interface StarterResolutionInput {
  readonly contextIds: readonly WorkContextId[];
  readonly recurringJobIds?: readonly RecurringJobId[];
  readonly limit?: number;
}

export interface StarterReview {
  readonly contextId: WorkContextId;
  readonly contextIds: readonly WorkContextId[];
  readonly recurringJobIds: readonly RecurringJobId[];
  readonly recommendations: readonly StarterRecommendation[];
  readonly selectedToolIds: readonly string[];
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function toolText(tool: ToolSummary): string {
  return normalize([
    tool.name,
    tool.summary,
    tool.category,
    ...tool.aliases,
    ...tool.jobs,
    ...tool.inputTypes,
  ].join(" "));
}

function matchesJob(tool: ToolSummary, jobId: RecurringJobId): boolean {
  const job = getRecurringJob(jobId);
  const text = toolText(tool);
  return job.matchTerms.some((term) => text.includes(normalize(term)));
}

function eligibleTools(tools: readonly ToolSummary[], quality: GoldQualityIndex): Map<string, ToolSummary> {
  const gold = goldToolIds(quality);
  return new Map(tools.filter((tool) => gold.has(tool.id)).map((tool) => [tool.id, tool]));
}

function contextIds(value: readonly WorkContextId[]): readonly WorkContextId[] {
  const valid = WORK_CONTEXT_PACKS.map(({ id }) => id);
  const seen = new Set<WorkContextId>();
  const result: WorkContextId[] = [];
  for (const id of value) {
    if (!valid.includes(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length === 3) break;
  }
  return result.length > 0 ? result : ["client-services"];
}

function recommendation(
  tool: ToolSummary,
  reason: StarterReason,
  quality: StarterQuality = "gold",
): StarterRecommendation {
  return {
    tool,
    reason: reason.label,
    reasonCode: reason.code,
    evidence: [...reason.evidence],
    quality,
  };
}

export function resolveStarter(
  input: StarterResolutionInput,
  tools: readonly ToolSummary[],
  quality: GoldQualityIndex,
): StarterReview {
  const selectedContexts = contextIds(input.contextIds);
  const contextId = selectedContexts[0]!;
  const jobs = [...new Set(input.recurringJobIds ?? [])].filter((job) => RECURRING_JOBS.some(({ id }) => id === job));
  const gold = eligibleTools(tools, quality);
  const requestedLimit = input.limit ?? (selectedContexts.length > 1 ? MAX_STARTER_TOOLS : jobs.length > 0 ? 12 : MIN_STARTER_TOOLS);
  const limit = Number.isFinite(requestedLimit) ? Math.max(MIN_STARTER_TOOLS, Math.min(MAX_STARTER_TOOLS, Math.floor(requestedLimit))) : MIN_STARTER_TOOLS;
  const selected = new Map<string, StarterRecommendation>();
  const add = (tool: ToolSummary | undefined, reason: StarterReason): void => {
    if (tool === undefined || selected.has(tool.id) || selected.size >= limit) return;
    selected.set(tool.id, recommendation(tool, reason));
  };

  for (const selectedContext of selectedContexts) {
    const pack = getWorkContextPack(selectedContext);
    for (const toolId of pack.toolIds) {
      add(gold.get(toolId), { code: "context-pack", label: pack.reasons[toolId] ?? `Part of the ${pack.label} work context.`, evidence: [pack.id] });
    }
    for (const membership of getContextMemberships(pack, tools)) {
      add(gold.get(membership.toolId), { code: "context-pack", label: membership.reason, evidence: membership.evidence });
    }
  }

  for (const jobId of jobs) {
    const job = getRecurringJob(jobId);
    for (const tool of tools) {
      if (gold.has(tool.id) && matchesJob(tool, jobId)) {
        const existing = selected.get(tool.id);
        if (existing === undefined) {
          add(tool, { code: "recurring-job", label: `Because you chose “${job.label}”.`, evidence: [job.id] });
        } else if (existing.reasonCode === "context-pack" || existing.reasonCode === "universal") {
          selected.set(tool.id, recommendation(tool, { code: "recurring-job", label: `Because you chose “${job.label}”.`, evidence: [job.id, ...existing.evidence] }));
        }
      }
    }
  }

  if (selected.size < limit) {
    for (const tool of tools) {
      if (gold.has(tool.id)) {
        add(tool, { code: "universal", label: `Gold-certified tool available for the ${getWorkContextPack(contextId).label} work context.`, evidence: ["quality:GOLD"] });
      }
    }
  }

  const recommendations = [...selected.values()].slice(0, limit);
  return {
    contextId,
    contextIds: selectedContexts,
    recurringJobIds: jobs,
    recommendations,
    selectedToolIds: recommendations.map(({ tool }) => tool.id),
  };
}

function isToolArray(value: GoldQualityIndex | readonly ToolSummary[]): value is readonly ToolSummary[] {
  return Array.isArray(value);
}

export function goldQualityIndexFromTools(tools: readonly ToolSummary[]): GoldQualityIndex {
  return {
    schemaVersion: 1,
    tools: tools.map((tool) => ({
      toolId: tool.id,
      status: "GOLD" as const,
      receiptPath: `provided:${tool.id}`,
      oracleEntryIds: [tool.gold.oracleEntryId],
      fixtureFamilies: [...tool.gold.fixtureFamilies],
    })),
  };
}

export function recommendStarter(
  input: StarterResolutionInput,
  tools: readonly ToolSummary[],
  quality: GoldQualityIndex,
): StarterRecommendation[];
export function recommendStarter(
  contextIds: WorkContextId | readonly WorkContextId[],
  recurringJobIds: readonly RecurringJobId[],
  availableGoldTools: readonly ToolSummary[],
): StarterRecommendation[];
export function recommendStarter(
  inputOrContexts: StarterResolutionInput | WorkContextId | readonly WorkContextId[],
  toolsOrJobs: readonly ToolSummary[] | readonly RecurringJobId[],
  qualityOrTools: GoldQualityIndex | readonly ToolSummary[],
): StarterRecommendation[] {
  if (isToolArray(qualityOrTools)) {
    const contextIds = typeof inputOrContexts === "string"
      ? [inputOrContexts]
      : Array.isArray(inputOrContexts)
        ? inputOrContexts
        : (inputOrContexts as StarterResolutionInput).contextIds;
    const recurringJobIds = Array.isArray(toolsOrJobs) ? toolsOrJobs as readonly RecurringJobId[] : [];
    return recommendStarter({ contextIds, recurringJobIds }, qualityOrTools, goldQualityIndexFromTools(qualityOrTools));
  }
  return [...resolveStarter(inputOrContexts as StarterResolutionInput, toolsOrJobs as readonly ToolSummary[], qualityOrTools).recommendations];
}

export const recommendStarterTools = recommendStarter;
export const resolveStarterRecommendations = recommendStarter;

export function toggleStarterTool(
  review: StarterReview,
  toolId: string,
  selected: boolean,
): StarterReview {
  const known = new Set(review.recommendations.map(({ tool }) => tool.id));
  if (!known.has(toolId)) return review;
  if (selected && !review.selectedToolIds.includes(toolId)) {
    if (review.selectedToolIds.length >= MAX_STARTER_TOOLS) return review;
    return { ...review, selectedToolIds: [...review.selectedToolIds, toolId] };
  }
  if (!selected) return { ...review, selectedToolIds: review.selectedToolIds.filter((id) => id !== toolId) };
  return review;
}

export function addStarterAlternative(
  review: StarterReview,
  tool: ToolSummary,
  quality: GoldQualityIndex,
): StarterReview {
  if (review.selectedToolIds.includes(tool.id) || review.selectedToolIds.length >= MAX_STARTER_TOOLS) return review;
  const existing = review.recommendations.find(({ tool: current }) => current.id === tool.id);
  if (existing !== undefined) return toggleStarterTool(review, tool.id, true);
  const isGold = goldToolIds(quality).has(tool.id);
  const alternative = recommendation(
    tool,
    isGold
      ? { code: "manual-add", label: "Gold-certified tool added from your Library search.", evidence: ["quality:GOLD", "source:library"] }
      : { code: "manual-add", label: "Not Gold-certified; added manually from Library.", evidence: ["source:library", "quality:unverified"] },
    isGold ? "gold" : "not-certified",
  );
  return {
    ...review,
    recommendations: [...review.recommendations, alternative],
    selectedToolIds: [...review.selectedToolIds, tool.id],
  };
}

export function findStarterAlternatives(
  query: string,
  tools: readonly ToolSummary[],
  quality: GoldQualityIndex,
  selectedToolIds: readonly string[],
  limit = 8,
  excludedToolIds: readonly string[] = [],
): StarterRecommendation[] {
  const contextTags = contextTagsForTools(tools);
  const metadata = tools.map((tool) => ({
    id: tool.id,
    route: tool.route,
    name: tool.name,
    summary: tool.summary,
    aliases: tool.aliases,
    jobs: tool.jobs,
    category: tool.category,
    inputTypes: tool.inputTypes,
    packTags: contextTags.get(tool.id) ?? [],
    engine: tool.engine,
    runtime: tool.runtime,
  }));
  const index = createSearchIndex(metadata);
  const selected = new Set([...selectedToolIds, ...excludedToolIds]);
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(20, Math.floor(limit))) : 8;
  const hits = searchCatalog(query, index, {}, safeLimit * 4);
  const gold = goldToolIds(quality);
  return hits
    .filter(({ tool }) => !selected.has(tool.id))
    .toSorted((left, right) => Number(gold.has(right.tool.id)) - Number(gold.has(left.tool.id)))
    .slice(0, safeLimit)
    .flatMap(({ tool }) => {
      const original = tools.find((candidate) => candidate.id === tool.id);
      if (original === undefined) return [];
      const isGold = gold.has(original.id);
      return [recommendation(
        original,
        isGold
          ? { code: "manual-add", label: "Gold-certified result from your Library search.", evidence: ["quality:GOLD", "source:library"] }
          : { code: "manual-add", label: "Not Gold-certified; add only if you choose it manually.", evidence: ["source:library", "quality:unverified"] },
        isGold ? "gold" : "not-certified",
      )];
    });
}
