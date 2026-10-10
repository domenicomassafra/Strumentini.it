/**
 * The membership store: which tools this person keeps, and what they used last.
 *
 * It is the same IndexedDB state the onboarding starter set writes
 * (`WorkbenchState.installedTools` + `.recent`) — one concept, one list, read
 * by the header chip, the favourites page, the tool cards, and the account
 * sync. There is no second "favourites" store to drift from it.
 *
 * Account sync uses a persisted server baseline and per-tool revisions. An
 * offline edit is compared with that baseline; a newer server removal wins.
 * First login adopts account state (including an empty account) instead of
 * importing untracked local favorites that might have been deleted elsewhere.
 */

import { createDefaultWorkProfile } from "../profile/work-profile";
import type { WorkProfile } from "../profile/work-profile";
import { createIndexedDbPersistence } from "../persistence/persistence";
import { createWorkbenchRepository } from "./repository";
import type { RecentToolActivity } from "./state";
import { createDefaultWorkbenchState, installTool, recordRecentTool, removeTool } from "./state";

export const MEMBERSHIP_EVENT = "strumentini:membership-changed";

export interface Membership {
  readonly installed: readonly string[];
  readonly recent: readonly RecentToolActivity[];
  readonly persisted?: boolean;
}

type Repository = ReturnType<typeof createWorkbenchRepository>;

let repositoryPromise: Promise<Repository> | undefined;
let membershipWriteQueue: Promise<void> = Promise.resolve();
let syncQueue: Promise<Membership | undefined> = Promise.resolve(undefined);

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
  const { state, persisted } = await repo.load();
  return { installed: [...state.installedTools], recent: [...state.recent], persisted };
}

/**
 * Writes the list, keeping the rest of the state untouched so a change made
 * here can never wipe the work profile the onboarding collected.
 */
function serializeWrite<T>(perform: () => Promise<T>): Promise<T> {
  const pending = membershipWriteQueue.then(perform, perform);
  membershipWriteQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

async function writeInstalled(
  mutate: (state: ReturnType<typeof createDefaultWorkbenchState>) => ReturnType<typeof createDefaultWorkbenchState>,
): Promise<Membership> {
  return serializeWrite(async () => {
    const repo = await repository();
    const { state, persisted } = await repo.load();
    const next = mutate(state);
    const saved = next === state ? { persisted } : await repo.save(next);
    const membership: Membership = { installed: [...next.installedTools], recent: [...next.recent], persisted: saved.persisted };
    broadcast(membership);
    return membership;
  });
}

export function setInstalled(toolId: string, installed: boolean): Promise<Membership> {
  return writeInstalled((state) => (installed ? installTool(state, toolId) : removeTool(state, toolId)));
}

export function toggleInstalled(toolId: string): Promise<Membership> {
  return writeInstalled((state) =>
    state.installedTools.includes(toolId) ? removeTool(state, toolId) : installTool(state, toolId));
}

/**
 * Called only after a completed, current operation. Serializing the full
 * load→update→save prevents two close completions from losing one recent.
 * Repository failures retain a session-only copy; never propagate to the tool.
 */
export async function noteToolUse(toolId: string): Promise<void> {
  const update = async (): Promise<void> => {
    try {
      const repo = await repository();
      const { state } = await repo.load();
      const next = recordRecentTool(state, toolId);
      if (next === state) return;
      const { persisted } = await repo.save(next);
      broadcast({ installed: [...next.installedTools], recent: [...next.recent], persisted });
    } catch {
      // Recording metadata must never invalidate a successfully produced file.
    }
  };
  await serializeWrite(update);
}

export function subscribeMembership(listener: (membership: Membership) => void): () => void {
  const handle = (event: Event): void => {
    if (event instanceof CustomEvent) listener(event.detail as Membership);
  };
  window.addEventListener(MEMBERSHIP_EVENT, handle);
  return () => window.removeEventListener(MEMBERSHIP_EVENT, handle);
}

const SYNC_BASELINE_KEY = "membership/favorites-sync:v1";
const TOOL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_LOCAL_FAVORITES = 500;
const MAX_REMOTE_ENTRIES = 2000;

export interface FavoriteRemoteEntry {
  readonly toolId: string;
  readonly installed: boolean;
  readonly revision: number;
}

export interface FavoriteRemoteSnapshot {
  readonly account: string;
  readonly revision: number;
  readonly entries: readonly FavoriteRemoteEntry[];
  readonly tools: readonly string[];
}

export interface FavoriteSyncBaseline {
  readonly version: 1;
  readonly account: string;
  readonly revision: number;
  readonly tools: readonly string[];
}

function validToolId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && TOOL_ID.test(value);
}

function validToolList(value: unknown, max = MAX_LOCAL_FAVORITES): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every(validToolId) && new Set(value).size === value.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSnapshot(raw: unknown): FavoriteRemoteSnapshot | undefined {
  if (!isRecord(raw) || raw.version !== 1 || typeof raw.account !== "string" || !/^[a-zA-Z0-9-]{1,128}$/u.test(raw.account)
    || !Number.isSafeInteger(raw.revision) || (raw.revision as number) < 0
    || !validToolList(raw.tools) || !Array.isArray(raw.entries) || raw.entries.length > MAX_REMOTE_ENTRIES) return undefined;
  const seen = new Set<string>();
  const enabled: string[] = [];
  for (const entry of raw.entries) {
    if (!isRecord(entry) || !validToolId(entry.toolId) || seen.has(entry.toolId)
      || typeof entry.installed !== "boolean" || !Number.isSafeInteger(entry.revision)
      || (entry.revision as number) < 1 || (entry.revision as number) > (raw.revision as number)) return undefined;
    seen.add(entry.toolId);
    if (entry.installed) enabled.push(entry.toolId);
  }
  if (new Set(enabled).size !== raw.tools.length || !raw.tools.every((id) => enabled.includes(id))) return undefined;
  if (raw.entries.length === 0 && raw.revision !== 0) return undefined;
  return raw as unknown as FavoriteRemoteSnapshot;
}

function parseBaseline(raw: unknown): FavoriteSyncBaseline | undefined {
  if (!isRecord(raw) || raw.version !== 1 || typeof raw.account !== "string"
    || !/^[a-zA-Z0-9-]{1,128}$/u.test(raw.account) || !Number.isSafeInteger(raw.revision)
    || (raw.revision as number) < 0 || !validToolList(raw.tools)) return undefined;
  return raw as unknown as FavoriteSyncBaseline;
}

/** A local intent is safe only if this specific tool has not changed remotely
 * since the device's last acknowledged snapshot. Other tools may advance.
 */
export function pendingFavoriteChanges(
  local: readonly string[], baseline: FavoriteSyncBaseline,
  remote: FavoriteRemoteSnapshot,
): readonly { toolId: string; installed: boolean }[] {
  const before = new Set(baseline.tools);
  const after = new Set(local);
  const revisions = new Map(remote.entries.map((entry) => [entry.toolId, entry.revision]));
  return [...new Set([...baseline.tools, ...local])]
    .filter((id) => before.has(id) !== after.has(id) && (revisions.get(id) ?? 0) <= baseline.revision)
    .map((toolId) => ({ toolId, installed: after.has(toolId) }));
}

const syncPersistence = createIndexedDbPersistence({ databaseName: "utility-workbench", storeName: "state" });
let sessionBaseline: FavoriteSyncBaseline | undefined;

async function loadBaseline(): Promise<FavoriteSyncBaseline | undefined> {
  try {
    return parseBaseline(await syncPersistence.get(SYNC_BASELINE_KEY)) ?? sessionBaseline;
  } catch {
    return sessionBaseline;
  }
}

async function persistBaseline(baseline: FavoriteSyncBaseline): Promise<boolean> {
  sessionBaseline = baseline;
  try {
    await syncPersistence.put(SYNC_BASELINE_KEY, baseline);
    return true;
  } catch {
    return false;
  }
}

async function fetchFavoriteSnapshot(): Promise<FavoriteRemoteSnapshot | undefined> {
  const response = await fetch("/api/favorites/sync", {
    credentials: "same-origin", headers: { accept: "application/json" },
  });
  if (!response.ok) return undefined;
  return parseSnapshot(await response.json());
}

function sameTools(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((toolId) => right.includes(toolId));
}

async function reconcileWithAccount(): Promise<Membership | undefined> {
  try {
    const remote = await fetchFavoriteSnapshot();
    if (remote === undefined) return undefined;
    const local = await loadMembership();
    const stored = await loadBaseline();
    // Even a zero-revision account can have pre-migration deletions. Its
    // state is authoritative until this device has acknowledged a baseline.
    const baseline: FavoriteSyncBaseline = stored?.account === remote.account ? stored : {
      version: 1, account: remote.account, revision: 0, tools: [],
    };
    const changes = stored?.account === remote.account
      ? pendingFavoriteChanges(local.installed, baseline, remote)
      : [];
    for (const change of changes) {
      const response = await fetch("/api/favorites/sync", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ...change, baseRevision: baseline.revision }),
      });
      if (response.status === 409) {
        const conflict = parseSnapshot(await response.json());
        // 409 from a newer edit is resolved by the server; a quota/corrupt
        // response with no newer edit leaves this local intent pending.
        if (conflict === undefined || conflict.account !== remote.account
          || (conflict.entries.find((entry) => entry.toolId === change.toolId)?.revision ?? 0) <= baseline.revision) return undefined;
      } else if (!response.ok) {
        return undefined;
      } else {
        const acknowledged = parseSnapshot(await response.json());
        if (acknowledged === undefined || acknowledged.account !== remote.account) return undefined;
      }
    }
    const final = changes.length > 0 ? await fetchFavoriteSnapshot() : remote;
    if (final === undefined || final.account !== remote.account) return undefined;
    // A click made during the network round-trip remains local, to be sent
    // by the next queued sync. Never overwrite an unacknowledged edit.
    if (!sameTools((await loadMembership()).installed, local.installed)) return undefined;
    const membership = await writeInstalled((state) => sameTools(state.installedTools, local.installed)
      ? { ...state, installedTools: [...final.tools] } : state);
    // A baseline must never advance past the durable local installed list:
    // on the next reload stale IndexedDB bytes could look like a new add and
    // resurrect the server tombstone.
    if (!membership.persisted) return undefined;
    const saved = await persistBaseline({ version: 1, account: final.account, revision: final.revision, tools: [...final.tools] });
    return saved ? membership : undefined;
  } catch {
    // Offline, expired session, unavailable storage/backend: retain local
    // choices and the previous baseline for a later explicit retry.
    return undefined;
  }
}

export function syncMembershipWithAccount(): Promise<Membership | undefined> {
  const pending = syncQueue.then(reconcileWithAccount, reconcileWithAccount);
  syncQueue = pending;
  return pending;
}

/** Changes are already durable locally; the sync service sends a conditional
 * write when signed in and keeps offline intents until reconciliation.
 */
export async function pushMembershipChange(_toolId: string, _installed: boolean, signedIn: boolean): Promise<void> {
  if (signedIn) await syncMembershipWithAccount();
}
