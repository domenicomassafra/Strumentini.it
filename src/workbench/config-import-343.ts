/** #343 — Device-only, explicit, versioned settings portability.
 * The schema contains only tool IDs, use metadata and the work profile.
 * It cannot contain files, last input/output, tokens, or account identities.
 */
import type { DayCode, WorkProfile } from "../profile/work-profile";
import type { RecentToolActivity, WorkbenchState } from "./state";

export const CONFIG_343_MAX_BYTES = 256 * 1024;
const MAX_IDS = 500;
const MAX_PACKS = 100;
const MAX_RECENTS = 12;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
const DATES = new Set(["system", "day-first", "month-first"]);
const NUMBERS = new Set(["system", "decimal-comma", "decimal-point"]);
const UNITS = new Set(["metric", "imperial", "mixed"]);

export interface DeviceConfig343 {
  kind: "utility-workbench-config";
  version: 2;
  installedTools: string[];
  packs: string[];
  layout: { mode: "list" };
  profile: WorkProfile;
  preferences: { compactRows: boolean };
  recent: RecentToolActivity[];
}

export type ConfigPreview343 =
  | { ok: true; config: DeviceConfig343; summary: {
      added: number; removed: number; recent: number; profileChanged: boolean; packsChanged: boolean;
    } }
  | { ok: false; error: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!record(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function idList(value: unknown, max: number, knownIds?: ReadonlySet<string>): value is string[] {
  return Array.isArray(value) && value.length <= max &&
    value.every((id) => typeof id === "string" && id.length <= 64 && ID.test(id) &&
      (knownIds === undefined || knownIds.has(id))) && new Set(value).size === value.length;
}

function plainText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= max &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function parseProfile(input: unknown): WorkProfile | undefined {
  if (!exactKeys(input, ["locale", "timezone", "currency", "dateFormat", "numberFormat", "preferredUnits", "workweek"])) return;
  if (!plainText(input.locale, 128) || !plainText(input.timezone, 128) || !plainText(input.currency, 8)) return;
  if (!DATES.has(String(input.dateFormat)) || !NUMBERS.has(String(input.numberFormat)) || !UNITS.has(String(input.preferredUnits))) return;
  const workweek = input.workweek;
  if (!Array.isArray(workweek) || workweek.length < 1 || workweek.length > 7 ||
    !workweek.every((day) => typeof day === "string" && DAYS.has(day)) || new Set(workweek).size !== workweek.length) return;
  return {
    locale: input.locale,
    timezone: input.timezone,
    currency: input.currency,
    dateFormat: input.dateFormat as WorkProfile["dateFormat"],
    numberFormat: input.numberFormat as WorkProfile["numberFormat"],
    preferredUnits: input.preferredUnits as WorkProfile["preferredUnits"],
    workweek: [...workweek] as DayCode[],
  };
}

function parseRecent(value: unknown, knownIds: ReadonlySet<string>): RecentToolActivity[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_RECENTS) return;
  const unique = new Set<string>();
  const result: RecentToolActivity[] = [];
  for (const item of value) {
    if (!exactKeys(item, ["toolId", "lastUsedAt", "useCount"])) return;
    if (!idList([item.toolId], 1, knownIds) || unique.has(item.toolId as string)) return;
    if (typeof item.lastUsedAt !== "string" || item.lastUsedAt.length > 64 ||
      !Number.isFinite(Date.parse(item.lastUsedAt)) || new Date(item.lastUsedAt).toISOString() !== item.lastUsedAt) return;
    if (!Number.isSafeInteger(item.useCount) || (item.useCount as number) < 1 || (item.useCount as number) > 1_000_000_000) return;
    unique.add(item.toolId as string);
    result.push({ toolId: item.toolId as string, lastUsedAt: item.lastUsedAt, useCount: item.useCount as number });
  }
  return result;
}

function decode(value: unknown, knownIds: ReadonlySet<string>): DeviceConfig343 | undefined {
  if (!exactKeys(value, ["kind", "version", "installedTools", "packs", "layout", "profile", "preferences", "recent"])) return;
  if (value.kind !== "utility-workbench-config" || value.version !== 2) return;
  if (!idList(value.installedTools, MAX_IDS, knownIds) || !idList(value.packs, MAX_PACKS)) return;
  if (!exactKeys(value.layout, ["mode"]) || value.layout.mode !== "list") return;
  if (!exactKeys(value.preferences, ["compactRows"]) || typeof value.preferences.compactRows !== "boolean") return;
  const profile = parseProfile(value.profile);
  const recent = parseRecent(value.recent, knownIds);
  if (!profile || !recent) return;
  return {
    kind: "utility-workbench-config", version: 2,
    installedTools: [...value.installedTools], packs: [...value.packs],
    layout: { mode: "list" }, profile,
    preferences: { compactRows: value.preferences.compactRows }, recent,
  };
}

/** Revalidate even when called with our own export; do not serialize unknown fields. */
export function exportDeviceConfig343(state: WorkbenchState, knownIds: ReadonlySet<string>): string {
  const raw = {
    kind: "utility-workbench-config", version: 2,
    installedTools: state.installedTools, packs: state.packs,
    layout: state.layout, profile: state.profile,
    preferences: state.preferences, recent: state.recent,
  };
  const config = decode(raw, knownIds);
  if (!config) throw new Error("La configurazione locale contiene identificativi o valori non supportati.");
  const serialized = JSON.stringify(config, null, 2);
  if (new TextEncoder().encode(serialized).byteLength > CONFIG_343_MAX_BYTES) {
    throw new Error("La configurazione supera il limite di 256 KiB.");
  }
  return serialized;
}

export function previewDeviceConfig343(serialized: string, current: WorkbenchState, knownIds: ReadonlySet<string>): ConfigPreview343 {
  if (serialized.length === 0 || serialized.length > CONFIG_343_MAX_BYTES ||
    new TextEncoder().encode(serialized).byteLength > CONFIG_343_MAX_BYTES) {
    return { ok: false, error: "Il file JSON è vuoto o supera il limite di 256 KiB." };
  }
  let value: unknown;
  try { value = JSON.parse(serialized); } catch {
    return { ok: false, error: "Il file selezionato non contiene JSON valido." };
  }
  if (record(value) && value.kind === "utility-workbench-config" && value.version === 1) {
    return { ok: false, error: "Questo file usa il vecchio schema v1, senza attività recenti. Esporta una nuova configurazione v2." };
  }
  const config = decode(value, knownIds);
  if (!config) return { ok: false, error: "Schema non supportato oppure configurazione malformata. Nessun dato è stato importato." };
  return {
    ok: true, config,
    summary: {
      added: config.installedTools.filter((id) => !current.installedTools.includes(id)).length,
      removed: current.installedTools.filter((id) => !config.installedTools.includes(id)).length,
      recent: config.recent.length,
      profileChanged: JSON.stringify(config.profile) !== JSON.stringify(current.profile) ||
        JSON.stringify(config.preferences) !== JSON.stringify(current.preferences),
      packsChanged: JSON.stringify(config.packs) !== JSON.stringify(current.packs),
    },
  };
}

export function applyDeviceConfig343(current: WorkbenchState, config: DeviceConfig343): WorkbenchState {
  return {
    ...current,
    installedTools: [...config.installedTools], packs: [...config.packs],
    layout: { mode: "list" },
    profile: { ...config.profile, workweek: [...config.profile.workweek] },
    preferences: { compactRows: config.preferences.compactRows },
    recent: config.recent.map((item) => ({ ...item })),
  };
}

/** Single IndexedDB read/write transaction, to prevent overwriting any newer
 * local change since the preview. No server calls, no memory-only success.
 */
export async function commitDeviceConfig343(expected: WorkbenchState, config: DeviceConfig343, knownIds: ReadonlySet<string>): Promise<boolean> {
  // Parse/normalize again at the write boundary: the preview object might have
  // been mutated by a caller after initial validation.
  const validated = decode(config, knownIds);
  if (!validated || new TextEncoder().encode(JSON.stringify(validated)).byteLength > CONFIG_343_MAX_BYTES) return false;
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean): void => { if (!settled) { settled = true; resolve(ok); } };
    let opening: IDBOpenDBRequest;
    try { opening = indexedDB.open("utility-workbench", 1); } catch { finish(false); return; }
    opening.onerror = () => finish(false);
    opening.onblocked = () => finish(false);
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains("state")) opening.result.createObjectStore("state");
    };
    opening.onsuccess = () => {
      const db = opening.result;
      let tx: IDBTransaction;
      try { tx = db.transaction("state", "readwrite"); } catch { db.close(); finish(false); return; }
      tx.oncomplete = () => { db.close(); finish(true); };
      tx.onerror = () => { db.close(); finish(false); };
      tx.onabort = () => { db.close(); finish(false); };
      const store = tx.objectStore("state");
      const lookup = store.get("workbench/state:v1");
      lookup.onsuccess = () => {
        // The caller must first read the current IndexedDB state. No write if
        // a newer edit landed after the import preview was displayed.
        if (lookup.result !== undefined && JSON.stringify(lookup.result) !== JSON.stringify(expected)) {
          tx.abort();
          return;
        }
        try { store.put(applyDeviceConfig343(expected, validated), "workbench/state:v1"); }
        catch { tx.abort(); }
      };
      lookup.onerror = () => tx.abort();
    };
  });
}
