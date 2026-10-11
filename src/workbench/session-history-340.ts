/**
 * #340 — bounded, page-memory-only history of completed local operations.
 * No storage, network transport, server calls, automatic replay or fake undo.
 * Callers must provide an actual operation; a digest records its completed bytes.
 * Cancelling is cooperative: work should observe the AbortSignal before side effects.
 */

const MAX_SNAPSHOTS = 3;
const MAX_ACTIVE = 3;
const MAX_RESULT_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = MAX_SNAPSHOTS * MAX_RESULT_BYTES;
const TOOL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export interface SessionResultReceipt340 {
  readonly id: string;
  readonly toolId: string;
  readonly sha256: string;
  readonly parentSha256?: string;
  readonly bytes: number;
  readonly completedAt: string;
}

export type TaskFailureReason340 =
  | "invalid-input" | "missing-parent" | "too-many-tasks" | "history-full"
  | "invalid-result" | "quota-exceeded" | "operation-failed"
  | "hash-unavailable" | "memory-unavailable" | "disposed";

export type TaskOutcome340 =
  | { readonly status: "saved"; readonly receipt: SessionResultReceipt340 }
  | { readonly status: "cancelled" }
  | { readonly status: "unavailable"; readonly reason: TaskFailureReason340 };

export type Recovery340 =
  | { readonly status: "recovered"; readonly receipt: SessionResultReceipt340; readonly bytes: Uint8Array }
  | { readonly status: "unavailable"; readonly reason: "missing" | "integrity" | "hash-unavailable" | "memory-unavailable" | "disposed" };

export interface TaskDefinition340 {
  readonly toolId: string;
  /** An explicit predecessor receipt must be present and hash-matched in this instance. */
  readonly previous?: Pick<SessionResultReceipt340, "id" | "sha256">;
  /** Resolve only after the local operation really succeeds. Never write to this store on error/cancel. */
  readonly execute: (input: Uint8Array | undefined, signal: AbortSignal) => Uint8Array | Promise<Uint8Array>;
}

export interface TaskHandle340 {
  readonly id: string;
  readonly finished: Promise<TaskOutcome340>;
  /** Cancel this active run. It never rolls back already completed side effects. */
  cancel(): boolean;
}

export interface SessionHistoryOptions340 {
  readonly maxResultBytes?: number;
  readonly maxTotalBytes?: number;
}

interface Entry {
  readonly receipt: SessionResultReceipt340;
  readonly snapshot: Uint8Array;
}

interface Active {
  readonly controller: AbortController;
}

const cancelled = Object.freeze({ status: "cancelled" as const });

function unavailable(reason: TaskFailureReason340): TaskOutcome340 {
  return { status: "unavailable", reason };
}

function validSize(value: number, max: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= max;
}

async function checksum(bytes: Uint8Array): Promise<string> {
  // An owned ArrayBuffer also satisfies WebCrypto's stricter TS BufferSource type.
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Every new instance starts empty; navigation/reload discards all results.
 * No sessionStorage, IndexedDB, URL history, global singleton or account sync.
 */
export function createSessionTaskHistory340(options: SessionHistoryOptions340 = {}) {
  const maxResultBytes = options.maxResultBytes ?? MAX_RESULT_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? MAX_TOTAL_BYTES;
  if (!validSize(maxResultBytes, MAX_RESULT_BYTES) || !validSize(maxTotalBytes, MAX_TOTAL_BYTES)) {
    throw new RangeError("SESSION_HISTORY_INVALID_BUDGET");
  }

  let nextId = 0;
  let disposed = false;
  const entries: Entry[] = [];
  const active = new Map<string, Active>();
  let total = 0;

  const cancel = (id: string): boolean => {
    const task = active.get(id);
    if (task === undefined) return false;
    active.delete(id);
    task.controller.abort();
    return true;
  };

  const list = (): readonly SessionResultReceipt340[] =>
    Object.freeze(entries.map((entry) => entry.receipt));

  const recover = async (proof: Pick<SessionResultReceipt340, "id" | "sha256">): Promise<Recovery340> => {
    if (disposed) return { status: "unavailable", reason: "disposed" };
    const entry = entries.find(({ receipt }) => receipt.id === proof.id);
    if (entry === undefined) return { status: "unavailable", reason: "missing" };
    if (entry.receipt.sha256 !== proof.sha256) return { status: "unavailable", reason: "integrity" };
    try {
      const bytes = entry.snapshot.slice(); // caller can mutate this copy only
      const actualHash = await checksum(bytes);
      if (disposed || !entries.includes(entry)) return { status: "unavailable", reason: "missing" };
      if (actualHash !== entry.receipt.sha256) return { status: "unavailable", reason: "integrity" };
      return { status: "recovered", receipt: entry.receipt, bytes };
    } catch (error) {
      return { status: "unavailable", reason: error instanceof RangeError ? "memory-unavailable" : "hash-unavailable" };
    }
  };

  /** Cancel without waiting for an operation that ignores AbortSignal to settle. */
  const withCancellation = <T>(work: Promise<T>, signal: AbortSignal): Promise<T | typeof cancelled> =>
    new Promise((resolve, reject) => {
      if (signal.aborted) { resolve(cancelled); return; }
      const abort = () => { signal.removeEventListener("abort", abort); resolve(cancelled); };
      signal.addEventListener("abort", abort, { once: true });
      work.then(
        (value) => { signal.removeEventListener("abort", abort); resolve(value); },
        (error: unknown) => { signal.removeEventListener("abort", abort); reject(error); },
      );
    });

  const run = (definition: TaskDefinition340): TaskHandle340 => {
    const id = `session-task-${++nextId}`;
    const controller = new AbortController();
    const handle = (finished: Promise<TaskOutcome340>): TaskHandle340 => ({
      id, finished, cancel: () => cancel(id),
    });
    if (disposed) return handle(Promise.resolve(unavailable("disposed")));
    if (typeof definition?.toolId !== "string" || definition.toolId.length > 64 ||
      !TOOL_ID.test(definition.toolId) || typeof definition.execute !== "function") {
      return handle(Promise.resolve(unavailable("invalid-input")));
    }
    if (active.size >= MAX_ACTIVE) return handle(Promise.resolve(unavailable("too-many-tasks")));
    if (entries.length >= MAX_SNAPSHOTS) return handle(Promise.resolve(unavailable("history-full")));

    active.set(id, { controller });
    const isCurrent = () => !disposed && active.get(id)?.controller === controller && !controller.signal.aborted;
    const finished = (async (): Promise<TaskOutcome340> => {
      try {
        // Defer invocation one microtask so cancelling before execution prevents the operation.
        await Promise.resolve();
        if (!isCurrent()) return cancelled;

        let previousBytes: Uint8Array | undefined;
        let parentSha256: string | undefined;
        if (definition.previous !== undefined) {
          const restored = await recover(definition.previous);
          if (!isCurrent()) return cancelled;
          if (restored.status !== "recovered") return unavailable("missing-parent");
          previousBytes = restored.bytes;
          parentSha256 = restored.receipt.sha256;
        }

        const result = await withCancellation(
          Promise.resolve().then(() => isCurrent() ? definition.execute(previousBytes, controller.signal) : cancelled),
          controller.signal,
        );
        if (!isCurrent() || result === cancelled) return cancelled;
        if (!(result instanceof Uint8Array)) return unavailable("invalid-result");
        if (result.byteLength > maxResultBytes || result.byteLength > maxTotalBytes - total) {
          return unavailable("quota-exceeded");
        }
        if (entries.length >= MAX_SNAPSHOTS) return unavailable("history-full");

        // Copy immediately before async hashing: upstream may reuse its buffer.
        let snapshot: Uint8Array;
        try { snapshot = result.slice(); } catch { return unavailable("memory-unavailable"); }
        let sha256: string;
        try { sha256 = await checksum(snapshot); } catch { return unavailable("hash-unavailable"); }
        if (!isCurrent()) return cancelled;
        if (snapshot.byteLength > maxTotalBytes - total || entries.length >= MAX_SNAPSHOTS) {
          return unavailable(entries.length >= MAX_SNAPSHOTS ? "history-full" : "quota-exceeded");
        }
        const receipt: SessionResultReceipt340 = Object.freeze({
          id, toolId: definition.toolId, sha256,
          ...(parentSha256 === undefined ? {} : { parentSha256 }),
          bytes: snapshot.byteLength, completedAt: new Date().toISOString(),
        });
        entries.unshift({ receipt, snapshot });
        total += snapshot.byteLength;
        return { status: "saved", receipt };
      } catch {
        return isCurrent() ? unavailable("operation-failed") : cancelled;
      } finally {
        if (active.get(id)?.controller === controller) active.delete(id);
      }
    })();
    return handle(finished);
  };

  const forget = (id: string): boolean => {
    if (disposed) return false;
    const index = entries.findIndex((entry) => entry.receipt.id === id);
    if (index === -1) return false;
    const [removed] = entries.splice(index, 1);
    if (removed !== undefined) total -= removed.snapshot.byteLength;
    return true;
  };

  const describe = () => Object.freeze({
    scope: "page-memory" as const,
    reload: "cleared" as const,
    undoSupported: false as const,
    active: active.size,
    retained: entries.length,
    usedBytes: total,
    maxResultBytes,
    maxTotalBytes,
    maxSnapshots: MAX_SNAPSHOTS,
  });

  const dispose = (): void => {
    disposed = true;
    for (const id of [...active.keys()]) cancel(id);
    entries.splice(0);
    total = 0;
  };

  return { run, cancel, list, recover, forget, describe, dispose };
}
