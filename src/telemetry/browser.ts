import {
  noopTelemetryAdapter,
  type AllowlistedTelemetryAdapterOptions,
  type TelemetryAdapter,
} from "./adapter";
import { createPrivacySafeOutcomeAdapter } from "./privacy-events-346";
import { isSafeTelemetryIdentifier, type ToolEntrySource } from "./schema";

const ENTRY_SOURCE_KEY = "strumentini:tool-entry-source:v1";
const OPENED_KEY = "strumentini:tool-opened:v1";
let currentAdapter: TelemetryAdapter = noopTelemetryAdapter;
let openedMarker: string | undefined;
const pendingEntrySources = new Map<string, ToolEntrySource>();

export function configureTelemetry(options: AllowlistedTelemetryAdapterOptions = {}): TelemetryAdapter {
  // The shared browser entrypoint is used by real tool runs and by the
  // explicit consent disclosure. Verify the actual session independently for
  // each dispatch. Neither a saved preference nor local telemetrySubjectId is
  // evidence of an authenticated user.
  let configured: TelemetryAdapter = noopTelemetryAdapter;
  configured = createPrivacySafeOutcomeAdapter({
    enabled: options.enabled,
    disclosed: options.disclosed,
    cohort: options.cohort,
    transport: options.transport,
    now: options.now,
    isActive: () => currentAdapter === configured,
    storage: () => {
      try {
        return globalThis.localStorage;
      } catch {
        return null;
      }
    },
    authenticated: async () => {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!response.ok) return false;
        const body = await response.json() as unknown;
        if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
        const user = (body as Record<string, unknown>).user;
        if (typeof user !== "object" || user === null || Array.isArray(user)) return false;
        return typeof (user as Record<string, unknown>).id === "string" &&
          ((user as Record<string, unknown>).id as string).trim().length > 0;
      } catch {
        return false;
      }
    },
  });
  currentAdapter = configured;
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
