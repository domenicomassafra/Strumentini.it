import { describe, expect, it, vi } from "vitest";
import { cronNextRunOperation, nextCronRuns } from "../src/engines/developer-web/web-reference";
import { runDeveloperWebTool } from "../src/engines/developer-web";

describe("cron calendar search budget", () => {
  it("skips impossible local calendar days instead of inspecting every minute", () => {
    const inspected = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts");
    try {
      expect(() => cronNextRunOperation("0 0 31 2 *", "2026-10-27T00:00:00Z", 1, "Europe/Rome"))
        .toThrow(/CRON_NOT_FOUND/u);
      expect(inspected.mock.calls.length).toBeLessThan(10_000);
    } finally {
      inspected.mockRestore();
    }
  });

  it("skips disallowed hours for a recurring schedule", () => {
    const inspected = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts");
    try {
      const result = cronNextRunOperation("0 9 * * *", "2026-01-01T00:00:00Z", 20, "Europe/Rome");
      expect(result.runs).toHaveLength(20);
      expect(result.runs).toEqual(expect.arrayContaining(["2026-01-01T08:00:00.000Z"]));
      expect(inspected.mock.calls.length).toBeLessThan(10_000);
    } finally {
      inspected.mockRestore();
    }
  });

  it("also skips impossible dates in the exported UTC calculator", () => {
    const inspected = vi.spyOn(Date.prototype, "getUTCMinutes");
    try {
      expect(() => nextCronRuns("0 0 31 2 *", "2026-10-27T00:00:00Z", 1))
        .toThrow(/CRON_NOT_FOUND/u);
      expect(inspected.mock.calls.length).toBeLessThan(10_000);
    } finally {
      inspected.mockRestore();
    }
  });

  it("honors cancellation while searching through calendar days", async () => {
    const controller = new AbortController();
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    let calls = 0;
    const inspected = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts")
      .mockImplementation(function (this: Intl.DateTimeFormat, ...args: Parameters<typeof original>) {
        if (++calls === 50) controller.abort();
        return original.apply(this, args);
      });
    try {
      await expect(runDeveloperWebTool("cron-next-run", {
        expression: "0 0 31 2 *", from: "2026-10-27T00:00:00Z", count: 1, timezone: "Europe/Rome",
      }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
      expect(calls).toBeLessThan(1_000);
    } finally {
      inspected.mockRestore();
    }
  });

  it.each([
    ["Europe/Rome", "2026-10-24T00:00:00Z"],
    ["America/New_York", "2026-10-31T00:00:00Z"],
    ["Australia/Lord_Howe", "2026-04-04T00:00:00Z"],
    ["Asia/Kathmandu", "2026-01-01T00:00:00Z"],
  ])("matches an independent UTC-minute search around %s", (zone, from) => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    const expected: string[] = [];
    const start = Date.parse(from);
    for (let minute = 1; minute < 4 * 24 * 60 && expected.length < 3; minute++) {
      const at = new Date(start + minute * 60_000);
      const parts = Object.fromEntries(formatter.formatToParts(at).map(({ type, value }) => [type, value]));
      if (parts.hour === "02" && parts.minute === "30") expected.push(at.toISOString());
    }
    expect(cronNextRunOperation("30 2 * * *", from, 3, zone).runs).toEqual(expected);
  });

  it.each([
    ["America/New_York", "2026-10-31T00:00:00Z", ["0 1 * * *", "30 1 * * *", "0 2 * * *"]],
    ["Europe/Rome", "2026-10-24T00:00:00Z", ["0 1 * * *", "30 2 * * *", "0 3 * * *"]],
    ["Australia/Lord_Howe", "2026-04-04T00:00:00Z", ["15 1 * * *", "45 1 * * *", "0 2 * * *"]],
  ])("preserves all UTC instants while skipping DST-adjacent hours in %s", (zone, from, expressions) => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    const instants = Array.from({ length: 4 * 24 * 60 }, (_, i) => new Date(Date.parse(from) + (i + 1) * 60_000));
    const wallTimes = instants.map((at) => {
      const parts = Object.fromEntries(formatter.formatToParts(at).map(({ type, value }) => [type, value]));
      return `${parts.hour}:${parts.minute}`;
    });
    for (const expression of expressions) {
      const [minute, hour] = expression.split(" ").map(Number);
      const target = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const expected = instants.filter((_, index) => wallTimes[index] === target).slice(0, 3).map((at) => at.toISOString());
      expect(cronNextRunOperation(expression, from, 3, zone).runs, `${zone} / ${expression}`).toEqual(expected);
    }
  });

  it("keeps DOM/DOW OR, spring gap and both autumn occurrences", () => {
    const orRule = cronNextRunOperation("0 9 13 * 5", "2026-01-01T00:00:00Z", 3, "Europe/Rome");
    expect(orRule.runs).toEqual([
      "2026-01-02T08:00:00.000Z", "2026-01-09T08:00:00.000Z", "2026-01-13T08:00:00.000Z",
    ]);
    expect(cronNextRunOperation("30 2 * * *", "2026-03-28T01:31:00Z", 1, "Europe/Rome").runs)
      .toEqual(["2026-03-30T00:30:00.000Z"]);
    expect(cronNextRunOperation("30 2 * * *", "2026-10-24T01:31:00Z", 2, "Europe/Rome").runs)
      .toEqual(["2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"]);
  });

  it("keeps the first run when a timezone repeats three hours", () => {
    // Casey moved from UTC+11 to UTC+8 on 2020-03-08, repeating 00:00–02:59.
    // A wide wall-clock probe can land in the repeated 00 hour and skip 01:00.
    const result = cronNextRunOperation("0 1 8 3 *", "2020-03-07T12:59:00Z", 2, "Antarctica/Casey");
    expect(result.runs).toEqual([
      "2020-03-07T14:00:00.000Z",
      "2020-03-07T17:00:00.000Z",
    ]);
  });
});
