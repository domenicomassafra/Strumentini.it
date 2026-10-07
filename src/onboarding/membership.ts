import type { ToolSummary } from "../catalog/manifest";
import {
  RECURRING_JOBS,
  WORK_CONTEXT_PACKS,
  type WorkContextId,
  type WorkContextPack,
} from "./contexts";

export interface WorkContextMembership {
  readonly contextId: WorkContextId;
  readonly toolId: string;
  readonly reason: string;
  readonly evidence: readonly string[];
}

const CATEGORY_HINTS: Readonly<Record<WorkContextId, readonly string[]>> = {
  "client-services": ["business", "client", "date-time", "files", "data", "text"],
  "marketing-growth": ["marketing", "web-operations", "image", "files-assets", "data", "text"],
  "data-cleanup": ["data", "text", "files", "csv", "table", "developer"],
  "research-evidence": ["research", "documents", "text", "data", "files"],
  "file-asset-handoff": ["files", "files-assets", "documents", "data", "text", "image", "media"],
};

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("it-IT")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function text(tool: ToolSummary): string {
  return normalize([tool.name, tool.summary, tool.category, ...tool.aliases, ...tool.jobs, ...tool.inputTypes].join(" "));
}

function inferredReason(pack: WorkContextPack, tool: ToolSummary): { reason: string; evidence: string } | undefined {
  const job = pack.jobIds
    .map((id) => RECURRING_JOBS.find((candidate) => candidate.id === id))
    .find((candidate) => candidate !== undefined && candidate.matchTerms.some((term) => text(tool).includes(normalize(term))));
  if (job !== undefined) return { reason: `Coerente con “${pack.label}” tramite l'attività “${job.label}”.`, evidence: job.id };
  const category = CATEGORY_HINTS[pack.id].find((hint) => normalize(tool.category).includes(normalize(hint)));
  if (category !== undefined) return { reason: `Coerente con “${pack.label}” tramite la famiglia di strumenti ${category}.`, evidence: `category:${category}` };
  return undefined;
}

export function getContextMemberships(
  contextOrPack: WorkContextId | WorkContextPack,
  tools: readonly ToolSummary[],
): WorkContextMembership[] {
  const pack = typeof contextOrPack === "string" ? WORK_CONTEXT_PACKS.find(({ id }) => id === contextOrPack) : contextOrPack;
  if (pack === undefined) return [];
  const explicit = new Set(pack.toolIds);
  return tools.flatMap((tool) => {
    if (explicit.has(tool.id)) {
      return [{
        contextId: pack.id,
        toolId: tool.id,
        reason: pack.reasons[tool.id] ?? `Incluso nel contesto “${pack.label}”.`,
        evidence: [pack.id],
      }];
    }
    const inferred = inferredReason(pack, tool);
    return inferred === undefined ? [] : [{
      contextId: pack.id,
      toolId: tool.id,
      reason: inferred.reason,
      evidence: [pack.id, inferred.evidence],
    }];
  });
}

export function getAllContextMemberships(tools: readonly ToolSummary[]): WorkContextMembership[] {
  return WORK_CONTEXT_PACKS.flatMap((pack) => getContextMemberships(pack, tools));
}

export function contextTagsForTools(tools: readonly ToolSummary[]): ReadonlyMap<string, readonly string[]> {
  const memberships = getAllContextMemberships(tools);
  const tags = new Map<string, string[]>();
  for (const membership of memberships) {
    const current = tags.get(membership.toolId) ?? [];
    if (!current.includes(membership.contextId)) current.push(membership.contextId);
    tags.set(membership.toolId, current);
  }
  return new Map([...tags].map(([toolId, values]) => [toolId, values.sort()]));
}
