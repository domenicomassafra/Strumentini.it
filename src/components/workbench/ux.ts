import type { ToolSummary } from "../../catalog/manifest";
import { categoryLabelIt, inputTypeLabelIt } from "../../i18n/it/taxonomy";
import type { WorkbenchState } from "../../workbench/state";

export interface WorkbenchSuggestion {
  tool: ToolSummary;
  reason: string;
}

const MAX_SUGGESTIONS = 4;
const RELATIVE_TIME_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
  ["second", 1000],
];

export function formatRecentActivity(at: string, now: number | Date = new Date()): string {
  const timestamp = Date.parse(at);
  const reference = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(timestamp) || !Number.isFinite(reference)) return "orario non disponibile";
  const formatter = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
  const difference = timestamp - reference;
  const absoluteDifference = Math.abs(difference);
  const unit = RELATIVE_TIME_UNITS.find(([, milliseconds]) => absoluteDifference >= milliseconds) ?? ["second", 1000];
  return formatter.format(Math.round(difference / unit[1]), unit[0]);
}

function sharedInputType(source: ToolSummary, tool: ToolSummary): string | undefined {
  return source.inputTypes.find((input) => tool.inputTypes.includes(input));
}

function handoffSourceFor(tool: ToolSummary, installed: readonly ToolSummary[]): ToolSummary | undefined {
  return installed.find((source) => {
    const outputs = source.handoff?.emits ?? [];
    const inputs = tool.handoff?.accepts ?? [];
    return outputs.some((output) => inputs.some((input) =>
      input.type === output.type && (!input.format || !output.format || input.format === output.format),
    ));
  });
}

function suggestionForTool(
  tool: ToolSummary,
  installed: readonly ToolSummary[],
  recent: ReadonlySet<string>,
): { reason: string; score: number } | undefined {
  if (recent.has(tool.id)) return { reason: "Hai usato questo strumento di recente.", score: 50 };

  const handoffSource = handoffSourceFor(tool, installed);
  if (handoffSource !== undefined) {
    return { reason: handoffSource.name + " può passare un risultato direttamente a questo strumento.", score: 40 };
  }

  const profileKeys = new Set(tool.profileFields.filter(({ sensitive }) => sensitive !== true).map(({ key }) => key));
  const profileSource = installed.find((source) =>
    source.profileFields.some(({ key, sensitive }) => sensitive !== true && profileKeys.has(key)),
  );
  if (profileSource !== undefined) {
    return { reason: "Usa gli stessi valori predefiniti del Profilo di lavoro di " + profileSource.name + ".", score: 30 };
  }

  const categorySource = installed.find((source) => source.category === tool.category);
  if (categorySource !== undefined) {
    return { reason: "Condivide attività della categoria " + categoryLabelIt(tool.category) + " con " + categorySource.name + ".", score: 20 };
  }

  for (const source of installed) {
    const input = sharedInputType(source, tool);
    if (input !== undefined) {
      return { reason: "Gestisce ingressi di tipo " + inputTypeLabelIt(input) + " come " + source.name + ".", score: 10 };
    }
  }
  return undefined;
}

export function getWorkbenchSuggestions(
  tools: readonly ToolSummary[],
  state: WorkbenchState,
  limit = 3,
): WorkbenchSuggestion[] {
  const installedIds = new Set(state.installedTools);
  const installed = state.installedTools.flatMap((id) => {
    const tool = tools.find((candidate) => candidate.id === id);
    return tool === undefined ? [] : [tool];
  });
  const recent = new Set(state.recent.map(({ toolId }) => toolId));
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(MAX_SUGGESTIONS, Math.floor(limit))) : 3;

  return tools
    .filter((tool) => !installedIds.has(tool.id))
    .flatMap((tool, index) => {
      const match = suggestionForTool(tool, installed, recent);
      return match === undefined ? [] : [{ tool, reason: match.reason, score: match.score, index }];
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, safeLimit)
    .map(({ tool, reason }) => ({ tool, reason }));
}
