import {
  isLocalToolRoute,
  type HandoffDescriptorDeclaration,
  type HandoffToolSummary,
  type ToolSummary,
} from "../catalog/manifest";
import { BINARY_HANDOFF_TYPES, type BinaryHandoffType } from "./binary-handoff";

export const MAX_RELATED_TOOL_SUGGESTIONS = 4;

export type HandoffRuntime = "table-csv-v1" | "binary-v1";

export interface HandoffGraphEdge {
  readonly kind: "handoff";
  readonly sourceId: string;
  readonly targetId: string;
  readonly runtime: HandoffRuntime;
  readonly emits: HandoffDescriptorDeclaration;
  readonly accepts: HandoffDescriptorDeclaration;
  /** Payload-dependent limits are rechecked by the concrete runtime before transfer. */
  readonly requiresPayloadValidation: true;
}

export type RelatedToolEvidenceKind =
  | "declared-descriptor-match"
  | "declared-output-input"
  | "shared-job"
  | "shared-input";

export interface RelatedToolEvidence {
  readonly kind: RelatedToolEvidenceKind;
  readonly values: readonly string[];
}

export interface RelatedToolEdge {
  readonly kind: "related";
  readonly sourceId: string;
  readonly targetId: string;
  readonly evidence: readonly RelatedToolEvidence[];
}

export interface RelatedToolGraphEntry {
  readonly toolId: string;
  readonly handoffs: readonly HandoffGraphEdge[];
  readonly related: readonly RelatedToolEdge[];
}

export interface RelatedToolGraph {
  readonly entries: readonly RelatedToolGraphEntry[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("it-IT");
}

function descriptorKey(descriptor: HandoffDescriptorDeclaration): string {
  return JSON.stringify([
    descriptor.type,
    descriptor.format ?? null,
    descriptor.maxBytes ?? null,
    descriptor.requiresUniqueHeaders ?? null,
    descriptor.acceptsRaggedRows ?? null,
  ]);
}

function handoffKey(tool: Pick<ToolSummary, "handoff">): string {
  const accepts = (tool.handoff?.accepts ?? []).map(descriptorKey).toSorted(compareText);
  const emits = (tool.handoff?.emits ?? []).map(descriptorKey).toSorted(compareText);
  return JSON.stringify({ accepts, emits });
}

function assertGraphInputs(
  tools: readonly ToolSummary[],
  handoffTargets: readonly HandoffToolSummary[],
): ReadonlyMap<string, ToolSummary> {
  const byId = new Map<string, ToolSummary>();
  const routeOwner = new Map<string, string>();
  for (const tool of tools) {
    if (byId.has(tool.id)) throw new Error(`Related-tool graph: duplicate tool id ${tool.id}`);
    const existingRouteOwner = routeOwner.get(tool.route);
    if (existingRouteOwner !== undefined) {
      throw new Error(`Related-tool graph: duplicate route ${tool.route} for ${existingRouteOwner} and ${tool.id}`);
    }
    if (!isLocalToolRoute(tool.route)) throw new Error(`Related-tool graph: invalid local route for ${tool.id}: ${tool.route}`);
    if (tool.route !== `/tools/${tool.id}`) {
      throw new Error(`Related-tool graph: dead or misaligned route for ${tool.id}: ${tool.route}`);
    }
    byId.set(tool.id, tool);
    routeOwner.set(tool.route, tool.id);
  }

  const handoffIds = new Set<string>();
  const handoffRoutes = new Set<string>();
  for (const target of handoffTargets) {
    if (handoffIds.has(target.id)) throw new Error(`Related-tool graph: duplicate handoff target id ${target.id}`);
    if (handoffRoutes.has(target.route)) throw new Error(`Related-tool graph: duplicate handoff target route ${target.route}`);
    handoffIds.add(target.id);
    handoffRoutes.add(target.route);

    const canonical = byId.get(target.id);
    if (canonical === undefined || canonical.route !== target.route || canonical.name !== target.name) {
      throw new Error(`Related-tool graph: dead or stale handoff target ${target.id}`);
    }
    if ((target.handoff?.accepts ?? []).length === 0) {
      throw new Error(`Related-tool graph: handoff target ${target.id} declares no accepted descriptor`);
    }
    if (handoffKey(canonical) !== handoffKey(target)) {
      throw new Error(`Related-tool graph: handoff projection disagrees with canonical manifest for ${target.id}`);
    }
  }
  return byId;
}

function descriptorPairMatches(
  emitted: HandoffDescriptorDeclaration,
  accepted: HandoffDescriptorDeclaration,
): boolean {
  if (emitted.type === "none" || accepted.type === "none" || emitted.type !== accepted.type) return false;
  if (accepted.format === undefined) return true;
  if (emitted.format === undefined) return false;
  return emitted.format === accepted.format;
}

function runtimeForPair(
  emitted: HandoffDescriptorDeclaration,
  accepted: HandoffDescriptorDeclaration,
): HandoffRuntime | null {
  if (emitted.type === "table") {
    if (accepted.type !== "table" || emitted.format !== "csv") return null;
    if (accepted.format !== undefined && accepted.format !== "csv") return null;
    return "table-csv-v1";
  }
  if (!BINARY_HANDOFF_TYPES.includes(emitted.type as BinaryHandoffType) || accepted.type !== emitted.type) return null;
  if (accepted.format === undefined) return "binary-v1";
  if (emitted.format === undefined) return null;
  return normalize(emitted.format) === normalize(accepted.format) ? "binary-v1" : null;
}

function canonicalValues(values: Iterable<string>): readonly string[] {
  return [...new Set([...values].map((value) => value.trim()).filter(Boolean))].toSorted(compareText);
}

function sharedValues(left: readonly string[], right: readonly string[]): readonly string[] {
  const rightByNormalized = new Map(right.map((value) => [normalize(value), value] as const));
  return canonicalValues(left.flatMap((value) => rightByNormalized.has(normalize(value)) ? [value] : []));
}

function declaredDescriptorMatches(source: ToolSummary, target: ToolSummary): readonly string[] {
  const matches: string[] = [];
  for (const emitted of source.handoff?.emits ?? []) {
    for (const accepted of target.handoff?.accepts ?? []) {
      if (!descriptorPairMatches(emitted, accepted)) continue;
      matches.push(`${emitted.type}:${emitted.format ?? "*"}`);
    }
  }
  return canonicalValues(matches);
}

function declaredOutputInputMatches(source: ToolSummary, target: ToolSummary): readonly string[] {
  const targetInputs = new Set(target.inputTypes.map(normalize));
  const matches: string[] = [];
  for (const emitted of source.handoff?.emits ?? []) {
    if (emitted.type !== "none" && targetInputs.has(normalize(emitted.type))) matches.push(emitted.type);
    if (emitted.format !== undefined && targetInputs.has(normalize(emitted.format))) matches.push(emitted.format);
  }
  return canonicalValues(matches);
}

function relatedEvidence(source: ToolSummary, target: ToolSummary): readonly RelatedToolEvidence[] {
  const evidence: RelatedToolEvidence[] = [];
  const descriptors = declaredDescriptorMatches(source, target);
  if (descriptors.length > 0) evidence.push({ kind: "declared-descriptor-match", values: descriptors });
  const outputInput = declaredOutputInputMatches(source, target);
  if (outputInput.length > 0) evidence.push({ kind: "declared-output-input", values: outputInput });
  const jobs = sharedValues(source.jobs, target.jobs);
  if (jobs.length > 0) evidence.push({ kind: "shared-job", values: jobs });
  const inputs = sharedValues(source.inputTypes, target.inputTypes);
  if (inputs.length > 0) evidence.push({ kind: "shared-input", values: inputs });
  return evidence;
}

const RELATED_EVIDENCE_WEIGHT: Readonly<Record<RelatedToolEvidenceKind, number>> = {
  "declared-descriptor-match": 8,
  "declared-output-input": 4,
  "shared-job": 2,
  "shared-input": 1,
};

function evidenceScore(evidence: readonly RelatedToolEvidence[]): number {
  return evidence.reduce((score, item) => score + RELATED_EVIDENCE_WEIGHT[item.kind] * item.values.length, 0);
}

function handoffEdgesFor(
  source: ToolSummary,
  handoffTargets: readonly HandoffToolSummary[],
): readonly HandoffGraphEdge[] {
  const edges = new Map<string, HandoffGraphEdge>();
  for (const emitted of source.handoff?.emits ?? []) {
    for (const target of handoffTargets) {
      if (target.id === source.id) continue;
      for (const accepted of target.handoff?.accepts ?? []) {
        const runtime = runtimeForPair(emitted, accepted);
        if (runtime === null) continue;
        const key = `${target.id}\u0000${runtime}`;
        const candidate: HandoffGraphEdge = {
          kind: "handoff",
          sourceId: source.id,
          targetId: target.id,
          runtime,
          emits: emitted,
          accepts: accepted,
          requiresPayloadValidation: true,
        };
        const existing = edges.get(key);
        if (existing === undefined) {
          edges.set(key, candidate);
          continue;
        }
        const candidatePair = `${descriptorKey(candidate.emits)}\u0000${descriptorKey(candidate.accepts)}`;
        const existingPair = `${descriptorKey(existing.emits)}\u0000${descriptorKey(existing.accepts)}`;
        if (compareText(candidatePair, existingPair) < 0) edges.set(key, candidate);
      }
    }
  }
  return [...edges.values()].toSorted((left, right) =>
    compareText(left.targetId, right.targetId) ||
    compareText(left.runtime, right.runtime) ||
    compareText(descriptorKey(left.emits), descriptorKey(right.emits)) ||
    compareText(descriptorKey(left.accepts), descriptorKey(right.accepts))
  );
}

function relatedEdgesFor(
  source: ToolSummary,
  tools: readonly ToolSummary[],
  handoffTargetIds: ReadonlySet<string>,
): readonly RelatedToolEdge[] {
  return tools
    .flatMap((target) => {
      if (target.id === source.id || handoffTargetIds.has(target.id)) return [];
      const evidence = relatedEvidence(source, target);
      return evidence.length === 0 ? [] : [{
        kind: "related" as const,
        sourceId: source.id,
        targetId: target.id,
        evidence,
      }];
    })
    .toSorted((left, right) =>
      evidenceScore(right.evidence) - evidenceScore(left.evidence) || compareText(left.targetId, right.targetId)
    )
    .slice(0, MAX_RELATED_TOOL_SUGGESTIONS);
}

export function buildRelatedToolGraph(
  tools: readonly ToolSummary[],
  handoffTargets: readonly HandoffToolSummary[],
): RelatedToolGraph {
  assertGraphInputs(tools, handoffTargets);
  const sortedTools = [...tools].toSorted((left, right) => compareText(left.id, right.id));
  const entries = sortedTools.map((source): RelatedToolGraphEntry => {
    const handoffs = handoffEdgesFor(source, handoffTargets);
    const handoffTargetIds = new Set(handoffs.map((edge) => edge.targetId));
    return {
      toolId: source.id,
      handoffs,
      related: relatedEdgesFor(source, sortedTools, handoffTargetIds),
    };
  });
  return { entries };
}

export function relatedToolsFor(
  sourceId: string,
  tools: readonly ToolSummary[],
  handoffTargets: readonly HandoffToolSummary[],
): readonly ToolSummary[] {
  const byId = new Map(tools.map((tool) => [tool.id, tool] as const));
  const entry = buildRelatedToolGraph(tools, handoffTargets).entries.find((candidate) => candidate.toolId === sourceId);
  if (entry === undefined) throw new Error(`Related-tool graph: unknown source tool ${sourceId}`);
  return entry.related.map((edge) => byId.get(edge.targetId)).filter((tool): tool is ToolSummary => tool !== undefined);
}
