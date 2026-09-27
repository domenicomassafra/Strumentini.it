import type { WorkProfile } from "../profile/work-profile";

export interface RecentToolActivity {
  toolId: string;
  lastUsedAt: string;
  useCount: number;
}

export interface WorkbenchState {
  version: 1;
  installedTools: string[];
  packs: string[];
  layout: {
    mode: "list";
  };
  profile: WorkProfile;
  preferences: {
    compactRows: boolean;
  };
  recent: RecentToolActivity[];
}

export function createDefaultWorkbenchState(profile: WorkProfile): WorkbenchState {
  return {
    version: 1,
    installedTools: ["business-day"],
    packs: [],
    layout: { mode: "list" },
    profile,
    preferences: { compactRows: false },
    recent: [],
  };
}

export function installTool(state: WorkbenchState, toolId: string): WorkbenchState {
  if (state.installedTools.includes(toolId)) return state;
  return { ...state, installedTools: [...state.installedTools, toolId] };
}

export function installPack(
  state: WorkbenchState,
  packId: string,
  toolIds: readonly string[],
): WorkbenchState {
  const normalizedPackId = packId.trim();
  if (normalizedPackId === "") return state;
  const installedTools = [...new Set([...state.installedTools, ...toolIds.filter((id) => id.trim() !== "")])];
  const packs = state.packs.includes(normalizedPackId) ? state.packs : [...state.packs, normalizedPackId];
  if (installedTools.length === state.installedTools.length && packs === state.packs) return state;
  return { ...state, installedTools, packs };
}

export function removePack(state: WorkbenchState, packId: string): WorkbenchState {
  if (!state.packs.includes(packId)) return state;
  return { ...state, packs: state.packs.filter((id) => id !== packId) };
}

export function applyStarterSelection(
  state: WorkbenchState,
  toolIds: readonly string[],
  profile: WorkProfile,
  packId?: string | readonly string[],
): WorkbenchState {
  const installedTools = [...new Set(toolIds)];
  const packs = (packId === undefined
    ? []
    : typeof packId === "string"
      ? [packId]
      : [...packId]).filter((id) => id.trim() !== "");
  return {
    ...state,
    installedTools,
    packs: packs.length === 0 ? state.packs : [...new Set(packs)],
    profile: structuredClone(profile),
  };
}

export const applyStarterTools = applyStarterSelection;

export function removeTool(state: WorkbenchState, toolId: string): WorkbenchState {
  return {
    ...state,
    installedTools: state.installedTools.filter((id) => id !== toolId),
  };
}

export function moveTool(
  state: WorkbenchState,
  toolId: string,
  direction: -1 | 1,
): WorkbenchState {
  const index = state.installedTools.indexOf(toolId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.installedTools.length) return state;
  const installedTools = [...state.installedTools];
  const current = installedTools[index]!;
  const adjacent = installedTools[target]!;
  installedTools[index] = adjacent;
  installedTools[target] = current;
  return { ...state, installedTools };
}

export function recordRecentTool(
  state: WorkbenchState,
  toolId: string,
  at = new Date().toISOString(),
): WorkbenchState {
  const previous = state.recent.find((entry) => entry.toolId === toolId);
  const entry: RecentToolActivity = {
    toolId,
    lastUsedAt: at,
    useCount: (previous?.useCount ?? 0) + 1,
  };
  return {
    ...state,
    recent: [entry, ...state.recent.filter((item) => item.toolId !== toolId)].slice(0, 12),
  };
}

export function clearRecent(state: WorkbenchState): WorkbenchState {
  return { ...state, recent: [] };
}
