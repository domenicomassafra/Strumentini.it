/**
 * The device-side workbench state, as the settings page reads and writes it.
 *
 * This is the same IndexedDB record the workbench, the favourites page and the
 * membership store use (`utility-workbench` / `state`): one identity, one
 * store, no second copy to drift. The work profile and the compact-rows
 * preference live in that record, so the Preferenze panel edits the real one.
 */

import { createIndexedDbPersistence } from "../../persistence/persistence";
import { forgetFavoriteSyncBaseline } from "../../workbench/membership";
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
import { SAVED_PDF_DB_341 } from "../../workbench/saved-pdf-341";
import { LAST_VALUE_STORAGE_KEY } from "../workbench/last-value";
import { THEME_STORAGE_KEY } from "../shell/theme";

export const SEARCH_CONTEXT_STORAGE_KEY = "strumentini:workbench-context:v1";
export const LAST_VALUE_KEY = LAST_VALUE_STORAGE_KEY;
export const THEME_KEY = THEME_STORAGE_KEY;

/** Every key this site may own, so "delete local data" is the whole list. */
const DEVICE_KEY_PREFIX = "strumentini:";
const LEGACY_DEVICE_KEYS = new Set(["strumentini.resilient-clock.v1"]);
function ownedStorageKey(key: string): boolean {
  return key.startsWith(DEVICE_KEY_PREFIX) || LEGACY_DEVICE_KEYS.has(key);
}
/** The file name the workbench already uses for the same export. */
const CONFIG_FILE_NAME = "workbench-config-v1.json";

type Repository = ReturnType<typeof createWorkbenchRepository>;

let repositoryPromise: Promise<Repository> | undefined;
let preferencesWriteQueue: Promise<void> = Promise.resolve();

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

/** Reload before each write; a settings-page snapshot can predate new favorites or activity. */
export function savePreferences(update: PreferencesUpdate): Promise<{ readonly state: WorkbenchState; readonly persisted: boolean }> {
  const pending = preferencesWriteQueue.then(async () => {
    const repo = await repository();
    const { state: current } = await repo.load();
    const next: WorkbenchState = {
      ...current,
      profile: update.profile === undefined ? current.profile : updateWorkProfile(current.profile, update.profile),
      preferences: update.compactRows === undefined
        ? current.preferences
        : { ...current.preferences, compactRows: update.compactRows },
    };
    const { persisted } = await repo.save(next);
    return { state: next, persisted };
  });
  preferencesWriteQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

/** Best-effort removal must never be mistaken for a fully successful reset.
 * A browser can allow writes but later refuse selected removeItem calls.
 */
function sweep(storage: Storage | undefined): boolean {
  if (storage === undefined) return false;
  const doomed: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null && ownedStorageKey(key)) doomed.push(key);
  }
  let cleared = true;
  for (const key of doomed) {
    try {
      storage.removeItem(key);
    } catch {
      cleared = false;
    }
  }
  // Detect silent no-op removal and keys written while the sweep was running.
  // An exception during enumeration also reaches the caller's failure path.
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null && ownedStorageKey(key)) cleared = false;
  }
  return cleared;
}

/** The explicit #341 PDF archive has its own database; clearing Workbench
 * alone is not an honest "clear local data" operation. A blocked deletion
 * must never be reported as a successful reset. */
async function clearVoluntaryPdfArchive(): Promise<boolean> {
  try {
    return await new Promise<boolean>((resolve) => {
      const request = indexedDB.deleteDatabase(SAVED_PDF_DB_341);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Empty a known local archive in one IndexedDB transaction, then read back. */
async function clearIndexedDbStore(databaseName: string, storeName: string): Promise<boolean> {
  let database: IDBDatabase | undefined;
  try {
    database = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open(databaseName, 1);
      opening.onupgradeneeded = () => {
        // A first reset must not leave a new database without its expected store.
        if (!opening.result.objectStoreNames.contains(storeName)) {
          opening.result.createObjectStore(storeName);
        }
      };
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
      opening.onblocked = () => reject(new Error("IndexedDB open blocked"));
    });
    if (!database.objectStoreNames.contains(storeName)) return true;
    await new Promise<void>((resolve, reject) => {
      const transaction = database!.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return await new Promise<boolean>((resolve, reject) => {
      const transaction = database!.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).count();
      let count = -1;
      request.onsuccess = () => { count = request.result; };
      transaction.oncomplete = () => resolve(count === 0);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    return false;
  } finally {
    database?.close();
  }
}

/**
 * Removes everything this site keeps on the device: the IndexedDB record, the
 * `strumentini:*` keys in both web storages, and the per-tab telemetry
 * markers through the module that owns them. Nothing on the account is touched.
 */
export async function clearDeviceData(): Promise<{ readonly persisted: boolean }> {
  // Invalidate any pending remote reconciliation before its delayed response can write.
  forgetFavoriteSyncBaseline();
  let persisted = true;
  try {
    resetTelemetryAdapter();
  } catch {
    persisted = false;
  }
  // Even when one storage is denied, continue deleting from the other.
  // Never claim complete erasure if a private consent/theme/history key remains.
  try {
    const localCleared = sweep(window.localStorage);
    persisted = localCleared && persisted;
  } catch {
    persisted = false;
  }
  try {
    const sessionCleared = sweep(window.sessionStorage);
    persisted = sessionCleared && persisted;
  } catch {
    persisted = false;
  }
  try {
    const result = await (await repository()).clear();
    persisted = persisted && result.persisted;
  } catch {
    persisted = false;
  }
  // The workbench, account sync, onboarding draft and presets share this store.
  // Editor archives hold opted-in original PDF/image bytes in separate stores.
  for (const [databaseName, storeName] of [
    ["utility-workbench", "state"],
    ["strumentini-editor-projects-412", "state"],
    ["strumentini-image-projects-385", "projects"],
  ] as const) {
    persisted = (await clearIndexedDbStore(databaseName, storeName)) && persisted;
  }
  // Independent best-effort deletion even if another storage step failed.
  // A different tab holding this database open can block deletion: fail closed
  // rather than claiming the saved documents were erased.
  persisted = (await clearVoluntaryPdfArchive()) && persisted;
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
