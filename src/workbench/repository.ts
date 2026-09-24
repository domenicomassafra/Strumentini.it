import type { PersistenceAdapter } from "../persistence/persistence";
import type { WorkbenchState } from "./state";

const STATE_KEY = "workbench/state:v1";
const MAX_STATE_BYTES = 1024 * 1024;
const MAX_INSTALLED_TOOLS = 500;
const MAX_PACKS = 100;
const MAX_PROFILE_STRING = 128;
const TOOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export interface PersistenceResult {
  persisted: boolean;
  warning?: string;
}

export interface WorkbenchLoadResult extends PersistenceResult {
  state: WorkbenchState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeText(value: unknown, maximum = MAX_PROFILE_STRING): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isToolId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && TOOL_ID_PATTERN.test(value);
}

function normalizeStoredState(value: unknown): WorkbenchState {
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== ["installedTools", "layout", "packs", "preferences", "profile", "recent", "version"].join("|") || value.version !== 1) throw new Error("INVALID_STORED_STATE");
  const installedTools = value.installedTools;
  const packs = value.packs;
  const layout = value.layout;
  const preferences = value.preferences;
  const profile = value.profile;
  const recent = value.recent;
  if (!Array.isArray(installedTools) || installedTools.length > MAX_INSTALLED_TOOLS || !installedTools.every(isToolId) || new Set(installedTools).size !== installedTools.length) throw new Error("INVALID_STORED_STATE");
  if (!Array.isArray(packs) || packs.length > MAX_PACKS || !packs.every(isToolId) || new Set(packs).size !== packs.length) throw new Error("INVALID_STORED_STATE");
  if (!isRecord(layout) || Object.keys(layout).join("|") !== "mode" || layout.mode !== "list") throw new Error("INVALID_STORED_STATE");
  if (!isRecord(preferences) || Object.keys(preferences).join("|") !== "compactRows" || typeof preferences.compactRows !== "boolean") throw new Error("INVALID_STORED_STATE");
  if (!isRecord(profile) || Object.keys(profile).sort().join("|") !== ["currency", "dateFormat", "locale", "numberFormat", "preferredUnits", "timezone", "workweek"].join("|")) throw new Error("INVALID_STORED_STATE");
  if (!isSafeText(profile.locale) || !isSafeText(profile.timezone) || !isSafeText(profile.currency) || !["system", "day-first", "month-first"].includes(String(profile.dateFormat)) || !["system", "decimal-comma", "decimal-point"].includes(String(profile.numberFormat)) || !["metric", "imperial", "mixed"].includes(String(profile.preferredUnits)) || !Array.isArray(profile.workweek) || profile.workweek.length === 0 || profile.workweek.length > 7 || !profile.workweek.every((day) => typeof day === "string" && ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].includes(day)) || new Set(profile.workweek).size !== profile.workweek.length) throw new Error("INVALID_STORED_STATE");
  if (!Array.isArray(recent) || recent.length > 12 || !recent.every((entry) => {
    if (!isRecord(entry) || Object.keys(entry).sort().join("|") !== "lastUsedAt|toolId|useCount" || !isToolId(entry.toolId) || typeof entry.lastUsedAt !== "string" || entry.lastUsedAt.length > 64 || Number.isNaN(Date.parse(entry.lastUsedAt))) return false;
    const useCount = entry.useCount;
    return typeof useCount === "number" && Number.isSafeInteger(useCount) && useCount >= 1 && useCount <= 1_000_000_000;
  })) throw new Error("INVALID_STORED_STATE");
  return structuredClone(value) as unknown as WorkbenchState;
}

function storageWarning(): string {
  return "Changes are available for this session, but this browser could not persist them. Check storage permissions or free space and try again.";
}

export function createWorkbenchRepository(
  persistence: PersistenceAdapter,
  initialState: WorkbenchState,
) {
  let sessionState = structuredClone(initialState);
  let writeQueue: Promise<void> = Promise.resolve();
  let sessionOnly = false;

  return {
    async load(): Promise<WorkbenchLoadResult> {
      if (sessionOnly) {
        return {
          state: structuredClone(sessionState),
          persisted: false,
          warning: storageWarning(),
        };
      }
      try {
        const stored = await persistence.get<WorkbenchState>(STATE_KEY);
        if (stored !== undefined) sessionState = normalizeStoredState(stored);
        return { state: structuredClone(sessionState), persisted: true };
      } catch {
        return {
          state: structuredClone(sessionState),
          persisted: false,
          warning: storageWarning(),
        };
      }
    },

    async save(state: WorkbenchState): Promise<PersistenceResult> {
      const normalized = normalizeStoredState(state);
      sessionState = structuredClone(normalized);
      const snapshot = structuredClone(normalized);
      if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > MAX_STATE_BYTES) {
        sessionOnly = true;
        return { persisted: false, warning: storageWarning() };
      }
      try {
      const write = writeQueue.then(() => persistence.put(STATE_KEY, snapshot));
      writeQueue = write.catch(() => undefined);
      await write;
      sessionOnly = false;
      return { persisted: true };
    } catch {
      sessionOnly = true;
      return { persisted: false, warning: storageWarning() };
    }
  },

    async clear(): Promise<PersistenceResult> {
      sessionState = structuredClone(initialState);
      try {
        await persistence.delete(STATE_KEY);
        sessionOnly = false;
        return { persisted: true };
      } catch {
        sessionOnly = true;
        return { persisted: false, warning: storageWarning() };
      }
    },
  };
}
