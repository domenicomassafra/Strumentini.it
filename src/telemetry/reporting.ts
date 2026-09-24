import {
  SEARCH_CATEGORY_CODES,
  SEARCH_INTENT_CODES,
  TOOL_ENTRY_SOURCES,
  validateTelemetryEvent,
  type TelemetryProperties,
  type ToolEntrySource,
  type ValidatedTelemetryEvent,
} from "./schema";

export const EXPERIMENT_IDS = ["EXP-01", "EXP-02", "EXP-03", "EXP-04", "EXP-05", "EXP-06"] as const;
export type ExperimentId = (typeof EXPERIMENT_IDS)[number];

export interface ReportOptions {
  now?: Date | number | string;
  windows?: readonly number[];
}

export interface ReturnMetric {
  readonly windowDays: number;
  readonly eligibleSubjects: number;
  readonly returnedSubjects: number;
  readonly rate: number;
}

export interface DistinctToolsMetric {
  readonly subjectCount: number;
  readonly distinctToolCount: number;
  readonly reusedToolCount: number;
  readonly totalDistinctTools: number;
  readonly averageDistinctTools: number;
  readonly subjectsWithReuse: number;
}

export interface DefaultFieldMetric {
  readonly applied: number;
  readonly overridden: number;
}

export interface PackMetric {
  readonly installed: number;
  readonly removed: number;
  readonly net: number;
  readonly byPack: Readonly<Record<string, { installed: number; removed: number }>>;
}

export interface SearchMetric {
  readonly total: number;
  readonly byIntent: Readonly<Record<string, number>>;
  readonly byCategory: Readonly<Record<string, number>>;
}

export interface HandoffMetric {
  readonly total: number;
  readonly byDescriptor: Readonly<Record<string, number>>;
}

export interface PortabilityMetric {
  readonly exported: number;
  readonly imported: number;
  readonly successfulImports: number;
  readonly rejectedImports: number;
  readonly failedImports: number;
  readonly importSuccessRate: number;
}

export interface ExperimentMetrics {
  readonly workbenchReturn7d: ReturnMetric;
  readonly workbenchReturn30d: ReturnMetric;
  readonly distinctToolsReused: DistinctToolsMetric;
  readonly distinctToolsReusedCount: number;
  readonly launchSourceCounts: Readonly<Record<ToolEntrySource, number>>;
  readonly launchSourceShare: Readonly<Record<ToolEntrySource, number>>;
  readonly defaultReuse: Readonly<Record<string, DefaultFieldMetric>>;
  readonly packBehavior: PackMetric;
  readonly searchZeroResults: SearchMetric;
  readonly handoffUse: HandoffMetric;
  readonly configPortability: PortabilityMetric;
}

export interface ExperimentObservation {
  readonly experimentId: ExperimentId;
  readonly decisionQuestion: string;
  readonly narrowOrRejectSignal: string;
  readonly observed: Readonly<Record<string, number>>;
}

export interface ExperimentReport {
  readonly cohortSize: number;
  readonly eventCount: number;
  readonly metrics: ExperimentMetrics;
  readonly experiments: Readonly<Record<ExperimentId, ExperimentObservation>>;
}

interface SubjectEvents {
  readonly timestamps: ValidatedTelemetryEvent[];
  readonly firstActivation?: number;
}

function zeroCounts<T extends string>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function timeValue(value: Date | number | string | undefined): number {
  const parsed = value === undefined ? Date.now() : new Date(value).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function propertyString(properties: TelemetryProperties, key: string): string | undefined {
  const value = properties[key];
  return typeof value === "string" ? value : undefined;
}

function validEvents(inputs: readonly unknown[], now: Date | number | string): ValidatedTelemetryEvent[] {
  const events: ValidatedTelemetryEvent[] = [];
  for (const input of inputs) {
    const validation = validateTelemetryEvent(input, now);
    if (validation.ok) events.push(validation.event);
  }
  return events;
}

function groupSubjects(events: readonly ValidatedTelemetryEvent[]): Map<string, SubjectEvents> {
  const groups = new Map<string, ValidatedTelemetryEvent[]>();
  for (const event of events) {
    if (event.subjectId === undefined) continue;
    const current = groups.get(event.subjectId) ?? [];
    current.push(event);
    groups.set(event.subjectId, current);
  }
  return new Map([...groups.entries()].map(([subjectId, subjectEvents]) => [
    subjectId,
    {
      timestamps: subjectEvents,
      ...(() => {
        const activation = subjectEvents
          .map((event) => Date.parse(event.occurredAt))
          .filter((value) => !Number.isNaN(value))
          .sort((left, right) => left - right)[0];
        return activation === undefined ? {} : { firstActivation: activation };
      })(),
    },
  ]));
}

function returnMetric(
  subjects: ReadonlyMap<string, SubjectEvents>,
  nowMs: number,
  windowDays: number,
): ReturnMetric {
  const boundary = nowMs - windowDays * 24 * 60 * 60 * 1000;
  let eligibleSubjects = 0;
  let returnedSubjects = 0;
  for (const subject of subjects.values()) {
    const activation = subject.firstActivation;
    if (activation === undefined || activation > nowMs) continue;
    eligibleSubjects += 1;
    const returned = subject.timestamps.some((event) => {
      if (event.name !== "tool_opened" || event.properties.entry_source !== "workbench") return false;
      const at = Date.parse(event.occurredAt);
      return !Number.isNaN(at) && at > activation && at >= boundary && at <= nowMs;
    });
    if (returned) returnedSubjects += 1;
  }
  return { windowDays, eligibleSubjects, returnedSubjects, rate: ratio(returnedSubjects, eligibleSubjects) };
}

function distinctToolsMetric(subjects: ReadonlyMap<string, SubjectEvents>): DistinctToolsMetric {
  const perSubject: number[] = [];
  const toolUsage = new Map<string, number>();
  for (const subject of subjects.values()) {
    const tools = new Set(
      subject.timestamps
        .filter((event) => event.name === "tool_completed" || event.name === "tool_opened")
        .map((event) => propertyString(event.properties, "tool_id"))
        .filter((value): value is string => value !== undefined),
    );
    perSubject.push(tools.size);
    for (const tool of tools) toolUsage.set(tool, (toolUsage.get(tool) ?? 0) + 1);
  }
  const totalDistinctTools = perSubject.reduce((sum, value) => sum + value, 0);
  return {
    subjectCount: perSubject.length,
    distinctToolCount: toolUsage.size,
    reusedToolCount: [...toolUsage.values()].filter((value) => value >= 2).length,
    totalDistinctTools,
    averageDistinctTools: ratio(totalDistinctTools, perSubject.length),
    subjectsWithReuse: perSubject.filter((value) => value >= 2).length,
  };
}

function launchSourceMetrics(events: readonly ValidatedTelemetryEvent[]): Pick<ExperimentMetrics, "launchSourceCounts" | "launchSourceShare"> {
  const launchSourceCounts = zeroCounts(TOOL_ENTRY_SOURCES);
  for (const event of events) {
    if (event.name !== "tool_opened") continue;
    const source = propertyString(event.properties, "entry_source");
    if (source !== undefined && Object.prototype.hasOwnProperty.call(launchSourceCounts, source)) {
      launchSourceCounts[source as ToolEntrySource] += 1;
    }
  }
  const total = Object.values(launchSourceCounts).reduce((sum, value) => sum + value, 0);
  return {
    launchSourceCounts,
    launchSourceShare: Object.fromEntries(TOOL_ENTRY_SOURCES.map((source) => [source, ratio(launchSourceCounts[source], total)])) as Record<ToolEntrySource, number>,
  };
}

function defaultReuseMetrics(events: readonly ValidatedTelemetryEvent[]): Record<string, DefaultFieldMetric> {
  const byField: Record<string, DefaultFieldMetric> = Object.create(null) as Record<string, DefaultFieldMetric>;
  for (const event of events) {
    if (event.name !== "profile_default_applied" && event.name !== "profile_default_overridden") continue;
    const field = propertyString(event.properties, "field_key");
    if (field === undefined) continue;
    const current = byField[field] ?? { applied: 0, overridden: 0 };
    byField[field] = event.name === "profile_default_applied"
      ? { ...current, applied: current.applied + 1 }
      : { ...current, overridden: current.overridden + 1 };
  }
  return byField;
}

function packMetrics(events: readonly ValidatedTelemetryEvent[]): PackMetric {
  const byPack: Record<string, { installed: number; removed: number }> = Object.create(null) as Record<string, { installed: number; removed: number }>;
  let installed = 0;
  let removed = 0;
  for (const event of events) {
    if (event.name !== "pack_installed" && event.name !== "pack_removed") continue;
    const pack = propertyString(event.properties, "pack_id");
    if (pack === undefined) continue;
    const current = byPack[pack] ?? { installed: 0, removed: 0 };
    if (event.name === "pack_installed") {
      installed += 1;
      byPack[pack] = { ...current, installed: current.installed + 1 };
    } else {
      removed += 1;
      byPack[pack] = { ...current, removed: current.removed + 1 };
    }
  }
  return { installed, removed, net: installed - removed, byPack };
}

function searchMetrics(events: readonly ValidatedTelemetryEvent[]): SearchMetric {
  const byIntent = zeroCounts(SEARCH_INTENT_CODES);
  const byCategory = zeroCounts(SEARCH_CATEGORY_CODES);
  let total = 0;
  for (const event of events) {
    if (event.name !== "search_zero_result") continue;
    total += 1;
    const intent = propertyString(event.properties, "intent_code");
    const category = propertyString(event.properties, "category_code");
    if (intent !== undefined && Object.prototype.hasOwnProperty.call(byIntent, intent)) {
      byIntent[intent as keyof typeof byIntent] += 1;
    }
    if (category !== undefined && Object.prototype.hasOwnProperty.call(byCategory, category)) {
      byCategory[category as keyof typeof byCategory] += 1;
    }
  }
  return { total, byIntent, byCategory };
}

function handoffMetrics(events: readonly ValidatedTelemetryEvent[]): HandoffMetric {
  const byDescriptor: Record<string, number> = Object.create(null) as Record<string, number>;
  let total = 0;
  for (const event of events) {
    if (event.name !== "handoff_used") continue;
    total += 1;
    const descriptor = propertyString(event.properties, "descriptor_type");
    if (descriptor !== undefined) byDescriptor[descriptor] = (byDescriptor[descriptor] ?? 0) + 1;
  }
  return { total, byDescriptor };
}

function portabilityMetrics(events: readonly ValidatedTelemetryEvent[]): PortabilityMetric {
  let exported = 0;
  let imported = 0;
  let successfulImports = 0;
  let rejectedImports = 0;
  let failedImports = 0;
  for (const event of events) {
    if (event.name === "config_exported") exported += 1;
    if (event.name !== "config_imported") continue;
    imported += 1;
    const outcome = propertyString(event.properties, "outcome");
    if (outcome === "success") successfulImports += 1;
    if (outcome === "rejected") rejectedImports += 1;
    if (outcome === "failed") failedImports += 1;
  }
  return {
    exported,
    imported,
    successfulImports,
    rejectedImports,
    failedImports,
    importSuccessRate: ratio(successfulImports, imported),
  };
}

function observation(
  experimentId: ExperimentId,
  decisionQuestion: string,
  narrowOrRejectSignal: string,
  observed: Record<string, number>,
): ExperimentObservation {
  return { experimentId, decisionQuestion, narrowOrRejectSignal, observed };
}

function experimentObservations(metrics: ExperimentMetrics, events: readonly ValidatedTelemetryEvent[]): Record<ExperimentId, ExperimentObservation> {
  const removals = events.filter((event) => event.name === "workspace_tool_removed").length;
  const onboarding = events.filter((event) => event.name === "onboarding_completed").length;
  const dataCompletions = events.filter((event) => event.name === "tool_completed" && event.properties.tool_family === "data").length;
  return {
    "EXP-01": observation(
      "EXP-01",
      "Does the generated starter set reduce correction work compared with self-browse?",
      "Narrow the onboarding promise if accepted starters are followed by repeated removals or searches without faster useful setup.",
      { onboardingCompleted: onboarding, workspaceRemovals: removals, workbenchReturn7d: metrics.workbenchReturn7d.returnedSubjects },
    ),
    "EXP-02": observation(
      "EXP-02",
      "Do safe Work Profile defaults create repeat value across tools?",
      "Narrow profile reuse if applied defaults are rarely reused or explicit overrides indicate more friction than benefit.",
      { distinctToolsReused: metrics.distinctToolsReused.subjectsWithReuse, defaultFields: Object.keys(metrics.defaultReuse).length },
    ),
    "EXP-03": observation(
      "EXP-03",
      "Does the Workbench retain users better than a one-off public launch?",
      "Narrow the persistent shell if few activated subjects return through Workbench or public launches dominate repeat use.",
      { return7dRate: metrics.workbenchReturn7d.rate, return30dRate: metrics.workbenchReturn30d.rate, workbenchLaunchShare: metrics.launchSourceShare.workbench },
    ),
    "EXP-04": observation(
      "EXP-04",
      "Do packs remain understandable enough to install and keep?",
      "Narrow or simplify packs when installs are followed by removals faster than they produce repeat use.",
      { packsInstalled: metrics.packBehavior.installed, packsRemoved: metrics.packBehavior.removed, netPacks: metrics.packBehavior.net },
    ),
    "EXP-05": observation(
      "EXP-05",
      "Does typed handoff replace copy/download/re-upload work?",
      "Narrow handoff UI if explicit handoffs remain rare after useful results and do not lead to another tool completion.",
      { handoffs: metrics.handoffUse.total, dataCompletions },
    ),
    "EXP-06": observation(
      "EXP-06",
      "Do bounded data/file jobs materially reduce the normal workflow?",
      "Deprioritize the data wedge if data-tool completion does not translate into repeat use or handoff value.",
      { dataCompletions, dataHandoffs: metrics.handoffUse.byDescriptor.table ?? 0, distinctToolsReused: metrics.distinctToolsReused.totalDistinctTools },
    ),
  };
}

export function deriveExperimentReport(events: readonly unknown[], options: ReportOptions = {}): ExperimentReport {
  const nowMs = timeValue(options.now);
  const now = new Date(nowMs);
  const valid = validEvents(events, now);
  const subjects = groupSubjects(valid);
  const launch = launchSourceMetrics(valid);
  const distinctTools = distinctToolsMetric(subjects);
  const metrics: ExperimentMetrics = {
    workbenchReturn7d: returnMetric(subjects, nowMs, 7),
    workbenchReturn30d: returnMetric(subjects, nowMs, 30),
    distinctToolsReused: distinctTools,
    distinctToolsReusedCount: distinctTools.reusedToolCount,
    launchSourceCounts: launch.launchSourceCounts,
    launchSourceShare: launch.launchSourceShare,
    defaultReuse: defaultReuseMetrics(valid),
    packBehavior: packMetrics(valid),
    searchZeroResults: searchMetrics(valid),
    handoffUse: handoffMetrics(valid),
    configPortability: portabilityMetrics(valid),
  };
  return {
    cohortSize: subjects.size,
    eventCount: valid.length,
    metrics,
    experiments: experimentObservations(metrics, valid),
  };
}

export const createExperimentReport = deriveExperimentReport;
export const reportTelemetry = deriveExperimentReport;
export const deriveTelemetryMetrics = deriveExperimentReport;
