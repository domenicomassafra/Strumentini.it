import type { PersistenceAdapter } from "../persistence/persistence";
import type { WorkbenchState } from "./state";

const STATE_KEY = "workbench/state:v1";

export interface PersistenceResult {
  persisted: boolean;
  warning?: string;
}

export interface WorkbenchLoadResult extends PersistenceResult {
  state: WorkbenchState;
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
        if (stored !== undefined && stored.version === 1) sessionState = structuredClone(stored);
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
      sessionState = structuredClone(state);
      const snapshot = structuredClone(state);
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
