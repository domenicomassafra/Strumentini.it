/**
 * The device-side workbench state, as the settings page reads and writes it.
 *
 * This is the same IndexedDB record the workbench, the favourites page and the
 * membership store use (`utility-workbench` / `state`): one identity, one
 * store, no second copy to drift. The work profile and the compact-rows
 * preference live in that record, so the Preferenze panel edits the real one.
 */

import { createIndexedDbPersistence } from "../../persistence/persistence";
import {
  createDefaultWorkProfile,
  type WorkProfile,
  type WorkProfileUpdate,
  updateWorkProfile,
} from "../../profile/work-profile";
import { createWorkbenchRepository } from "../../workbench/repository";
import { createDefaultWorkbenchState, type WorkbenchState } from "../../workbench/state";
import { exportWorkbenchConfig } from "../../workbench/portability";
import { resetTelemetryAdapter } from "../../telemetry/browser";
import { LAST_VALUE_STORAGE_KEY } from "../workbench/last-value";
import { THEME_STORAGE_KEY } from "../shell/theme";

export const SEARCH_CONTEXT_STORAGE_KEY = "strumentini:workbench-context:v1";
export const LAST_VALUE_KEY = LAST_VALUE_STORAGE_KEY;
export const THEME_KEY = THEME_STORAGE_KEY;

/** Every key this site may own, so "delete local data" is the whole list. */
const DEVICE_KEY_PREFIX = "strumentini:";
/** The file name the workbench already uses for the same export. */
const CONFIG_FILE_NAME = "workbench-config-v1.json";

type Repository = ReturnType<typeof createWorkbenchRepository>;

let repositoryPromise: Promise<Repository> | undefined;

function browserProfile(): WorkProfile {
  return createDefaultWorkProfile({
    locale: navigator.language || "it-IT",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
}

function repository(): Promise<Repository> {
  repositoryPromise ??= Promise.resolve(
    createWorkbenchRepository(
      createIndexedDbPersistence({ databaseName: "utility-workbench", storeName: "state" }),
      createDefaultWorkbenchState(browserProfile()),
    ),
  );
  return repositoryPromise;
}

export interface LoadedWorkbench {
  readonly state: WorkbenchState;
  /** False when this browser refused to persist: the state is session-only. */
  readonly persisted: boolean;
}

export async function loadWorkbenchState(): Promise<LoadedWorkbench> {
  const { state, persisted } = await (await repository()).load();
  return { state, persisted };
}

export interface PreferencesUpdate {
  readonly profile?: WorkProfileUpdate;
  readonly compactRows?: boolean;
}

/** One write for the whole Preferenze panel, so a half-saved pair cannot exist. */
export async function savePreferences(
  current: WorkbenchState,
  update: PreferencesUpdate,
): Promise<{ readonly state: WorkbenchState; readonly persisted: boolean }> {
  const repo = await repository();
  const next: WorkbenchState = {
    ...current,
    profile: update.profile === undefined ? current.profile : updateWorkProfile(current.profile, update.profile),
    preferences: update.compactRows === undefined
      ? current.preferences
      : { ...current.preferences, compactRows: update.compactRows },
  };
  const { persisted } = await repo.save(next);
  return { state: next, persisted };
}

function sweep(storage: Storage | undefined): void {
  if (storage === undefined) return;
  const doomed: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null && key.startsWith(DEVICE_KEY_PREFIX)) doomed.push(key);
  }
  for (const key of doomed) {
    try {
      storage.removeItem(key);
    } catch {
      /* A refused key is a key the page could not have written either. */
    }
  }
}

/**
 * Removes everything this site keeps on the device: the IndexedDB record, the
 * `strumentini:*` keys in both web storages, and the per-tab telemetry
 * markers through the module that owns them. Nothing on the account is touched.
 */
export async function clearDeviceData(): Promise<{ readonly persisted: boolean }> {
  let persisted = true;
  try {
    resetTelemetryAdapter();
  } catch {
    persisted = false;
  }
  try {
    sweep(window.localStorage);
    sweep(window.sessionStorage);
  } catch {
    persisted = false;
  }
  try {
    const result = await (await repository()).clear();
    persisted = persisted && result.persisted;
  } catch {
    persisted = false;
  }
  return { persisted };
}

/** Downloads the same configuration file the workbench exports. */
export function downloadWorkbenchConfig(state: WorkbenchState): void {
  const blob = new Blob([exportWorkbenchConfig(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = CONFIG_FILE_NAME;
  anchor.click();
  URL.revokeObjectURL(url);
}
