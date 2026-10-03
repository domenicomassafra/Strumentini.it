/**
 * The membership store: which tools this person keeps, and what they used last.
 *
 * It is the same IndexedDB state the onboarding starter set writes
 * (`WorkbenchState.installedTools` + `.recent`) — one concept, one list, read
 * by the header chip, the favourites page, the tool cards, and the account
 * sync. There is no second "favourites" store to drift from it.
 *
 * When a session exists the list is reconciled with the account: local and
 * server sets are unioned so a signed-in person never loses a tool they added
 * while signed out, and the union is pushed back.
 */

import { createDefaultWorkProfile } from "../profile/work-profile";
import type { WorkProfile } from "../profile/work-profile";
import { createIndexedDbPersistence } from "../persistence/persistence";
import { createWorkbenchRepository } from "./repository";
import type { RecentToolActivity } from "./state";
import { createDefaultWorkbenchState, installTool, recordRecentTool, removeTool } from "./state";

export const MEMBERSHIP_EVENT = "strumentiutili:membership-changed";

export interface Membership {
  readonly installed: readonly string[];
  readonly recent: readonly RecentToolActivity[];
}

type Repository = ReturnType<typeof createWorkbenchRepository>;

let repositoryPromise: Promise<Repository> | undefined;

/**
 * The profile a first-time visitor starts from, read from the browser rather
 * than assumed: the locale the device reports and its own timezone, falling
 * back to Italian and UTC.
 */
function browserEnvironment(): Pick<WorkProfile, "locale" | "timezone"> {
  const locale = typeof navigator !== "undefined" && navigator.language !== "" ? navigator.language : "it-IT";
  let timezone = "UTC";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    /* An engine without the timezone database keeps UTC. */
  }
  return { locale, timezone };
}

function repository(): Promise<Repository> {
  repositoryPromise ??= Promise.resolve(
    createWorkbenchRepository(
      createIndexedDbPersistence({ databaseName: "utility-workbench", storeName: "state" }),
      createDefaultWorkbenchState(createDefaultWorkProfile(browserEnvironment())),
    ),
  );
  return repositoryPromise;
}

function broadcast(membership: Membership): void {
  window.dispatchEvent(new CustomEvent<Membership>(MEMBERSHIP_EVENT, { detail: membership }));
}

export async function loadMembership(): Promise<Membership> {
  const repo = await repository();
  const { state } = await repo.load();
  return { installed: [...state.installedTools], recent: [...state.recent] };
}

/**
 * Writes the list, keeping the rest of the state untouched so a change made
 * here can never wipe the work profile the onboarding collected.
 */
async function writeInstalled(
  mutate: (state: ReturnType<typeof createDefaultWorkbenchState>) => ReturnType<typeof createDefaultWorkbenchState>,
): Promise<Membership> {
  const repo = await repository();
  const { state } = await repo.load();
  const next = mutate(state);
  if (next !== state) await repo.save(next);
  const membership: Membership = { installed: [...next.installedTools], recent: [...next.recent] };
  broadcast(membership);
  return membership;
}

export function setInstalled(toolId: string, installed: boolean): Promise<Membership> {
  return writeInstalled((state) => (installed ? installTool(state, toolId) : removeTool(state, toolId)));
}

export function toggleInstalled(toolId: string): Promise<Membership> {
  return writeInstalled((state) =>
    state.installedTools.includes(toolId) ? removeTool(state, toolId) : installTool(state, toolId));
}

/** Called by a tool surface when it produces a value, so "recenti" is real. */
export async function noteToolUse(toolId: string): Promise<void> {
  const repo = await repository();
  const { state } = await repo.load();
  await repo.save(recordRecentTool(state, toolId));
}

export function subscribeMembership(listener: (membership: Membership) => void): () => void {
  const handle = (event: Event): void => {
    if (event instanceof CustomEvent) listener(event.detail as Membership);
  };
  window.addEventListener(MEMBERSHIP_EVENT, handle);
  return () => window.removeEventListener(MEMBERSHIP_EVENT, handle);
}

/**
 * Reconciles the device list with the account list. Failures are silent: the
 * device list is authoritative when there is no reachable backend.
 */
export async function syncMembershipWithAccount(): Promise<Membership | undefined> {
  let remote: string[] | undefined;
  try {
    const response = await fetch("/api/favorites", { credentials: "same-origin", headers: { accept: "application/json" } });
    if (!response.ok) return undefined;
    const body = await response.json() as { tools?: unknown };
    if (!Array.isArray(body.tools)) return undefined;
    remote = body.tools.filter((id): id is string => typeof id === "string");
  } catch {
    return undefined;
  }

  const local = await loadMembership();
  const union = [...new Set([...local.installed, ...remote])];
  const missing = local.installed.filter((id) => !remote.includes(id));
  const membership = await writeInstalled((state) => ({ ...state, installedTools: union }));

  await Promise.all(missing.map(async (toolId) => {
    try {
      await fetch(`/api/favorites/${encodeURIComponent(toolId)}`, { method: "PUT", credentials: "same-origin" });
    } catch {
      /* The next successful load reconciles again. */
    }
  }));

  return membership;
}

/** Pushes one change to the account when signed in; a no-op signed out. */
export async function pushMembershipChange(toolId: string, installed: boolean, signedIn: boolean): Promise<void> {
  if (!signedIn) return;
  try {
    await fetch(`/api/favorites/${encodeURIComponent(toolId)}`, {
      method: installed ? "PUT" : "DELETE",
      credentials: "same-origin",
    });
  } catch {
    /* Device state is already written; the next load reconciles. */
  }
}
