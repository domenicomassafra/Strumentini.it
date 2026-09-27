import {
  createAllowlistedTelemetryAdapter,
  noopTelemetryAdapter,
  type AllowlistedTelemetryAdapterOptions,
  type TelemetryAdapter,
} from "./adapter";
import { isSafeTelemetryIdentifier, type ToolEntrySource } from "./schema";

const ENTRY_SOURCE_KEY = "strumentiutili:tool-entry-source:v1";
const OPENED_KEY = "strumentiutili:tool-opened:v1";
let currentAdapter: TelemetryAdapter = noopTelemetryAdapter;
let openedMarker: string | undefined;
const pendingEntrySources = new Map<string, ToolEntrySource>();

export function configureTelemetry(options: AllowlistedTelemetryAdapterOptions = {}): TelemetryAdapter {
  currentAdapter = createAllowlistedTelemetryAdapter(options);
  return currentAdapter;
}

export function getTelemetryAdapter(): TelemetryAdapter {
  return currentAdapter;
}

export function resetTelemetryAdapter(): void {
  currentAdapter = noopTelemetryAdapter;
  openedMarker = undefined;
  pendingEntrySources.clear();
  try {
    globalThis.sessionStorage?.removeItem(ENTRY_SOURCE_KEY);
    globalThis.sessionStorage?.removeItem(OPENED_KEY);
  } catch {
    return;
  }
}

function readPendingEntrySources(): Map<string, ToolEntrySource> {
  const stored = new Map(pendingEntrySources);
  try {
    const parsed = JSON.parse(globalThis.sessionStorage?.getItem(ENTRY_SOURCE_KEY) ?? "{}") as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      for (const [toolId, source] of Object.entries(parsed)) {
        if (isSafeTelemetryIdentifier(toolId) && (source === "public" || source === "search" || source === "workbench")) {
          stored.set(toolId, source);
        }
      }
    }
  } catch {
    return stored;
  }
  return stored;
}

function writePendingEntrySources(sources: ReadonlyMap<string, ToolEntrySource>): void {
  pendingEntrySources.clear();
  for (const [toolId, source] of sources) pendingEntrySources.set(toolId, source);
  try {
    globalThis.sessionStorage?.setItem(ENTRY_SOURCE_KEY, JSON.stringify(Object.fromEntries(sources)));
  } catch {
    return;
  }
}

export function rememberToolEntrySource(toolId: string, source: ToolEntrySource): void {
  if (!isSafeTelemetryIdentifier(toolId)) return;
  const sources = readPendingEntrySources();
  sources.set(toolId, source);
  writePendingEntrySources(sources);
}

export function consumeToolEntrySource(toolId: string): ToolEntrySource | undefined {
  const sources = readPendingEntrySources();
  const source = sources.get(toolId);
  sources.delete(toolId);
  writePendingEntrySources(sources);
  return source;
}

export function markToolOpened(toolId: string): void {
  if (!isSafeTelemetryIdentifier(toolId)) return;
  openedMarker = toolId;
  try {
    globalThis.sessionStorage?.setItem(OPENED_KEY, toolId);
  } catch {
    return;
  }
}

export function consumeToolOpenedMarker(toolId: string): boolean {
  if (openedMarker === toolId) {
    openedMarker = undefined;
    try {
      globalThis.sessionStorage?.removeItem(OPENED_KEY);
    } catch {
      return true;
    }
    return true;
  }
  try {
    const marked = globalThis.sessionStorage?.getItem(OPENED_KEY);
    if (marked !== toolId) return false;
    globalThis.sessionStorage?.removeItem(OPENED_KEY);
    return true;
  } catch {
    return false;
  }
}
