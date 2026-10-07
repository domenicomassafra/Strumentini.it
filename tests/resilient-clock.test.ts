import { describe, expect, it } from "vitest";
import {
  createResilientClock,
  parseResilientClock,
  pauseResilientClock,
  resetResilientClock,
  serializeResilientClock,
  snapshotResilientClock,
  startResilientClock,
} from "../src/engines/date-time/resilient-clock";

describe("timestamp-derived resilient clock", () => {
  it("derives elapsed and remaining time from timestamps rather than tick count", () => {
    const idle = createResilientClock("timer", 1_000, 10_000);
    const running = startResilientClock(idle, 2_000);
    expect(snapshotResilientClock(running, 7_500)).toMatchObject({ elapsedMs: 5_500, remainingMs: 4_500, status: "running" });
    expect(snapshotResilientClock(running, 25_000)).toMatchObject({ remainingMs: 0, status: "complete" });
  });

  it("pauses and resumes without counting paused time", () => {
    const running = startResilientClock(createResilientClock("stopwatch", 0), 1_000);
    const paused = pauseResilientClock(running, 6_000);
    expect(snapshotResilientClock(paused, 60_000).elapsedMs).toBe(5_000);
    const resumed = startResilientClock(paused, 100_000);
    expect(snapshotResilientClock(resumed, 103_000).elapsedMs).toBe(8_000);
  });

  it("restores deterministic state across reload-sized gaps", () => {
    const running = startResilientClock(createResilientClock("pomodoro", 1_000, 25 * 60_000), 2_000);
    const restored = parseResilientClock(serializeResilientClock(running));
    expect(snapshotResilientClock(restored, 62_000)).toMatchObject({ elapsedMs: 60_000, remainingMs: 24 * 60_000 });
    expect(resetResilientClock(restored, 80_000)).toMatchObject({ status: "idle", accumulatedMs: 0, startedAtMs: null });
  });

  it("rejects corrupt persisted state and invalid duration bounds", () => {
    expect(() => parseResilientClock("{bad")).toThrow("INVALID_CLOCK_STATE");
    expect(() => createResilientClock("timer", 0, 0)).toThrow("INVALID_CLOCK_DURATION");
  });
});
