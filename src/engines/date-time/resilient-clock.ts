export type ResilientClockMode = "timer" | "stopwatch" | "pomodoro";
export type ResilientClockStatus = "idle" | "running" | "paused" | "complete";

export interface ResilientClockState {
  readonly version: 1;
  readonly mode: ResilientClockMode;
  readonly status: ResilientClockStatus;
  readonly durationMs: number | null;
  readonly accumulatedMs: number;
  readonly startedAtMs: number | null;
  readonly updatedAtMs: number;
}

export interface ResilientClockSnapshot {
  readonly mode: ResilientClockMode;
  readonly status: ResilientClockStatus;
  readonly elapsedMs: number;
  readonly remainingMs: number | null;
  readonly referenceMs: number;
}

function finiteMilliseconds(value: number, code: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
  return Math.floor(value);
}

function requireDuration(mode: ResilientClockMode, durationMs: number | null): number | null {
  if (mode === "stopwatch") return null;
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 86_400_000 * 30) throw new Error("INVALID_CLOCK_DURATION");
  return Math.floor(durationMs);
}

export function createResilientClock(mode: ResilientClockMode, nowMs: number, durationMs: number | null = null): ResilientClockState {
  const now = finiteMilliseconds(nowMs, "INVALID_CLOCK_TIME");
  return {
    version: 1,
    mode,
    status: "idle",
    durationMs: requireDuration(mode, durationMs),
    accumulatedMs: 0,
    startedAtMs: null,
    updatedAtMs: now,
  };
}

function rawElapsed(state: ResilientClockState, nowMs: number): number {
  const now = finiteMilliseconds(nowMs, "INVALID_CLOCK_TIME");
  if (state.status !== "running" || state.startedAtMs === null) return state.accumulatedMs;
  return state.accumulatedMs + Math.max(0, now - state.startedAtMs);
}

export function snapshotResilientClock(state: ResilientClockState, nowMs: number): ResilientClockSnapshot {
  const now = finiteMilliseconds(nowMs, "INVALID_CLOCK_TIME");
  const elapsedMs = rawElapsed(state, now);
  const remainingMs = state.durationMs === null ? null : Math.max(0, state.durationMs - elapsedMs);
  const status: ResilientClockStatus = state.durationMs !== null && remainingMs === 0 && state.status === "running" ? "complete" : state.status;
  return { mode: state.mode, status, elapsedMs, remainingMs, referenceMs: now };
}

export function startResilientClock(state: ResilientClockState, nowMs: number): ResilientClockState {
  const now = finiteMilliseconds(nowMs, "INVALID_CLOCK_TIME");
  if (state.status === "running") return state;
  const snapshot = snapshotResilientClock(state, now);
  const accumulatedMs = snapshot.status === "complete" ? 0 : snapshot.elapsedMs;
  return { ...state, status: "running", accumulatedMs, startedAtMs: now, updatedAtMs: now };
}

export function pauseResilientClock(state: ResilientClockState, nowMs: number): ResilientClockState {
  const now = finiteMilliseconds(nowMs, "INVALID_CLOCK_TIME");
  if (state.status !== "running") return state;
  const elapsedMs = rawElapsed(state, now);
  if (state.durationMs !== null && elapsedMs >= state.durationMs) {
    return { ...state, status: "complete", accumulatedMs: state.durationMs, startedAtMs: null, updatedAtMs: now };
  }
  return { ...state, status: "paused", accumulatedMs: elapsedMs, startedAtMs: null, updatedAtMs: now };
}

export function resetResilientClock(state: ResilientClockState, nowMs: number): ResilientClockState {
  return createResilientClock(state.mode, nowMs, state.durationMs);
}

export function serializeResilientClock(state: ResilientClockState): string {
  return JSON.stringify(state);
}

export function parseResilientClock(value: string): ResilientClockState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("INVALID_CLOCK_STATE");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("INVALID_CLOCK_STATE");
  const record = parsed as Record<string, unknown>;
  if (record.version !== 1 || (record.mode !== "timer" && record.mode !== "stopwatch" && record.mode !== "pomodoro")) throw new Error("INVALID_CLOCK_STATE");
  if (record.status !== "idle" && record.status !== "running" && record.status !== "paused" && record.status !== "complete") throw new Error("INVALID_CLOCK_STATE");
  const durationMs = record.durationMs === null ? null : typeof record.durationMs === "number" ? record.durationMs : NaN;
  const accumulatedMs = typeof record.accumulatedMs === "number" ? record.accumulatedMs : NaN;
  const startedAtMs = record.startedAtMs === null ? null : typeof record.startedAtMs === "number" ? record.startedAtMs : NaN;
  const updatedAtMs = typeof record.updatedAtMs === "number" ? record.updatedAtMs : NaN;
  const mode = record.mode;
  requireDuration(mode, durationMs);
  finiteMilliseconds(accumulatedMs, "INVALID_CLOCK_STATE");
  if (startedAtMs !== null) finiteMilliseconds(startedAtMs, "INVALID_CLOCK_STATE");
  finiteMilliseconds(updatedAtMs, "INVALID_CLOCK_STATE");
  if (record.status === "running" && startedAtMs === null) throw new Error("INVALID_CLOCK_STATE");
  if (record.status !== "running" && startedAtMs !== null) throw new Error("INVALID_CLOCK_STATE");
  return {
    version: 1,
    mode,
    status: record.status,
    durationMs,
    accumulatedMs: Math.floor(accumulatedMs),
    startedAtMs: startedAtMs === null ? null : Math.floor(startedAtMs),
    updatedAtMs: Math.floor(updatedAtMs),
  };
}
