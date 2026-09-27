/**
 * Il valore corrente — the per-tool last value shown in the Workbench gutter.
 *
 * The gutter is the one place every produced value lands. The Workbench column
 * is the same idea read from the other side: for each installed tool it shows
 * the value that tool last produced, or the tool's runtime state when it has
 * not produced one yet.
 *
 * This module is the seam between the tool surfaces that produce values and
 * the Workbench that displays them. It is deliberately narrow:
 *
 * - It stores a short rendered scalar only. No inputs, no file names, no URLs,
 *   no task content. A value that is not a displayable scalar is refused.
 * - It is bounded in both count and length, and every read is validated, so a
 *   corrupt or hostile store degrades to "no value" rather than to bad state.
 * - It never leaves the device. `localStorage` is the only sink.
 */

export const LAST_VALUE_EVENT = "utilityos:last-value";
export const LAST_VALUE_STORAGE_KEY = "utilityos:last-values:v1";
export const LAST_VALUE_WINDOW_EVENT = "utilityos:last-values-changed";

/** Bounded so the gutter stays a reading column rather than an archive. */
const MAX_RECORDS = 40;
const MAX_VALUE_LENGTH = 40;
const MAX_UNIT_LENGTH = 12;

export interface ToolLastValue {
  readonly toolId: string;
  readonly value: string;
  readonly unit?: string;
  readonly at: string;
}

const TOOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * A value is displayable only if it survives a single-line, bounded, printable
 * check. This is the privacy boundary as well as the layout boundary: task
 * content pasted into the gutter is truncated away, not stored.
 */
function displayScalar(value: unknown): string | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  if (typeof value !== "string") return undefined;
  const collapsed = value.replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/gu, " ").trim();
  if (collapsed === "") return undefined;
  return collapsed.length > MAX_VALUE_LENGTH ? collapsed.slice(0, MAX_VALUE_LENGTH - 1) + "…" : collapsed;
}

function displayUnit(unit: unknown): string | undefined {
  if (typeof unit !== "string") return undefined;
  const collapsed = unit.replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/gu, " ").trim();
  if (collapsed === "") return undefined;
  return collapsed.length > MAX_UNIT_LENGTH ? collapsed.slice(0, MAX_UNIT_LENGTH - 1) + "…" : collapsed;
}

function readRecord(value: unknown): ToolLastValue | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const source = value as Readonly<Record<string, unknown>>;
  if (typeof source.toolId !== "string" || !TOOL_ID_PATTERN.test(source.toolId)) return undefined;
  const display = displayScalar(source.value);
  if (display === undefined) return undefined;
  const at = typeof source.at === "string" && Number.isFinite(Date.parse(source.at))
    ? source.at
    : new Date(0).toISOString();
  const unit = displayUnit(source.unit);
  return unit === undefined
    ? { toolId: source.toolId, value: display, at }
    : { toolId: source.toolId, value: display, unit, at };
}

/** Validates an arbitrary parsed payload down to a keyed, bounded map. */
export function sanitizeLastValues(value: unknown): Record<string, ToolLastValue> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const records: Record<string, ToolLastValue> = {};
  for (const entry of Object.values(value as Readonly<Record<string, unknown>>)) {
    const record = readRecord(entry);
    if (record === undefined) continue;
    records[record.toolId] = record;
  }
  return records;
}

/**
 * The most recent record for a tool wins. Called on every publish so a tool
 * that runs twice in a session always shows the value the user last saw.
 */
export function mergeLastValue(
  current: Readonly<Record<string, ToolLastValue>>,
  toolId: string,
  value: string,
  unit?: string,
  at = new Date().toISOString(),
): Record<string, ToolLastValue> {
  if (!TOOL_ID_PATTERN.test(toolId)) return { ...current };
  const display = displayScalar(value);
  if (display === undefined) return { ...current };
  const entry = displayUnit(unit) === undefined
    ? { toolId, value: display, at }
    : { toolId, value: display, unit: displayUnit(unit)!, at };
  const merged: Record<string, ToolLastValue> = { ...current, [toolId]: entry };
  // Drop the oldest entries by timestamp, then by insertion, so the column
  // stays bounded even when a caller publishes a long tail of tool ids.
  const ordered = Object.entries(merged)
    .sort((left, right) => Date.parse(right[1].at) - Date.parse(left[1].at))
    .slice(0, MAX_RECORDS);
  return Object.fromEntries(ordered);
}

export function readLastValues(storage: Pick<Storage, "getItem"> | undefined = browserStorage()): Record<string, ToolLastValue> {
  if (storage === undefined) return {};
  try {
    const raw = storage.getItem(LAST_VALUE_STORAGE_KEY);
    if (raw === null) return {};
    return sanitizeLastValues(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeLastValues(
  values: Readonly<Record<string, ToolLastValue>>,
  storage: Pick<Storage, "setItem"> | undefined = browserStorage(),
): void {
  if (storage === undefined) return;
  try {
    storage.setItem(LAST_VALUE_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // A full or unavailable store must never break the page that produced the
    // value. The gutter falls back to runtime state.
  }
}

function browserStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Records the value a tool produced. Safe to call from any tool surface; the
 * Workbench is the reader. Also broadcast so an open Workbench tab updates
 * without a reload.
 */
export function recordLastValue(toolId: string, value: string, unit?: string): void {
  const merged = mergeLastValue(readLastValues(), toolId, value, unit);
  writeLastValues(merged);
  try {
    globalThis.dispatchEvent(new CustomEvent(LAST_VALUE_EVENT, { detail: { toolId } }));
  } catch {
    void 0;
  }
}

export type LastValueListener = (values: Readonly<Record<string, ToolLastValue>>) => void;

/**
 * Subscribes to last-value changes from this tab, from other tabs, and from
 * the storage event raised when the browser evicts or shares the record.
 */
export function subscribeLastValues(listener: LastValueListener): () => void {
  const refresh = (): void => listener(readLastValues());
  const onSameTab = (): void => refresh();
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === LAST_VALUE_STORAGE_KEY) refresh();
  };

  globalThis.addEventListener?.(LAST_VALUE_EVENT, onSameTab);
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    globalThis.removeEventListener?.(LAST_VALUE_EVENT, onSameTab);
    globalThis.removeEventListener?.("storage", onStorage);
  };
}

export { MAX_RECORDS as LAST_VALUE_RECORD_LIMIT };
