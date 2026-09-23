import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateMarginMarkup,
  convertRate,
  findTimezoneOverlap,
  formatInstantInZone,
  resolveLocalDateTime,
} from "../src/engines/client-time-math";

const timezoneFixtures = JSON.parse(
  readFileSync(new URL("../quality/fixtures/timezone-dst/vectors.json", import.meta.url), "utf8"),
) as {
  zone: string;
  vectors: Array<{ instant: string; local: string; case?: string }>;
};

const businessMathFixtures = JSON.parse(
  readFileSync(new URL("../quality/fixtures/business-math/vectors.json", import.meta.url), "utf8"),
) as {
  vectors: Array<Record<string, string>>;
};

function fixtureValue(vector: Record<string, string>, key: string): string {
  const value = vector[key];
  if (value === undefined) throw new Error(`fixture field missing: ${key}`);
  return value;
}

describe("client/time/math engine seam", () => {
  it("converts an hourly rate to a day with an explicit work basis", () => {
    expect(convertRate({ amount: "50.00", from: "hour", to: "day", hoursPerDay: "8" })).toMatchObject({
      amount: "400.00",
      assumptions: { hoursPerDay: "8" },
    });
  });

  it("keeps rate arithmetic exact until the declared final half-up rounding", () => {
    expect(convertRate({ amount: "1", from: "hour", to: "day", hoursPerDay: "2.345" })).toEqual({
      amount: "2.35",
      assumptions: { hoursPerDay: "2.345" },
      rounding: { mode: "half-up", decimalPlaces: 2, stage: "final-only" },
      formula: "amount × target-unit-hours ÷ source-unit-hours",
    });
    expect(convertRate({ amount: "100", from: "project", to: "hour", projectHours: "3" }).amount).toBe("33.33");
    expect(convertRate({ amount: "10.075", from: "hour", to: "hour" }).amount).toBe("10.08");
    expect(() => convertRate({ amount: "100", from: "project", to: "hour" })).toThrow("PROJECT_HOURS_REQUIRED");
    expect(() => convertRate({ amount: "-1", from: "hour", to: "day" })).toThrow("INVALID_RATE");
  });

  it("matches the independent hour/day fixture without implying FX", () => {
    const vector = businessMathFixtures.vectors.find((item) => item.case === "hour-day");
    if (vector === undefined) throw new Error("hour-day fixture missing");
    const actual = convertRate({
      amount: fixtureValue(vector, "hourly"),
      from: "hour",
      to: "day",
      hoursPerDay: fixtureValue(vector, "hours_per_day"),
    });
    expect(actual.amount).toBe(fixtureValue(vector, "daily"));
  });

  it("keeps margin and markup as distinct formulas from independent literals", () => {
    const vector = businessMathFixtures.vectors.find((item) => item.case === "margin-vs-markup");
    if (vector === undefined) throw new Error("margin-vs-markup fixture missing");
    const actual = calculateMarginMarkup(fixtureValue(vector, "price"), fixtureValue(vector, "cost"));
    expect(actual.profit).toBe(fixtureValue(vector, "profit"));
    expect(actual.marginPercent).toBe(`${fixtureValue(vector, "margin_percent")}.00`);
    expect(actual.markupPercent).toBe(`${fixtureValue(vector, "markup_percent")}.00`);
    expect(actual.formulas).toEqual({
      profit: "price − cost",
      margin: "profit ÷ price × 100",
      markup: "profit ÷ cost × 100",
    });
  });

  it("surfaces denominator errors without discarding the other valid result", () => {
    const zeroPrice = calculateMarginMarkup("0", "100");
    expect(zeroPrice.marginPercent).toBeNull();
    expect(zeroPrice.markupPercent).toBe("-100.00");
    expect(zeroPrice.denominatorErrors).toEqual([
      expect.objectContaining({ metric: "margin", code: "INVALID_MARGIN_DENOMINATOR" }),
    ]);

    const zeroCost = calculateMarginMarkup("100", "0");
    expect(zeroCost.marginPercent).toBe("100.00");
    expect(zeroCost.markupPercent).toBeNull();
    expect(zeroCost.denominatorErrors).toEqual([
      expect.objectContaining({ metric: "markup", code: "INVALID_MARKUP_DENOMINATOR" }),
    ]);
  });

  it("renders every independent IANA/DST instant fixture exactly", () => {
    for (const vector of timezoneFixtures.vectors) {
      expect(formatInstantInZone(vector.instant, timezoneFixtures.zone).local).toBe(vector.local);
    }
  });

  it("rejects DST gaps and overlaps unless overlap disambiguation is explicit", () => {
    expect(() => resolveLocalDateTime("2024-03-31", "02:30", "Europe/Rome")).toThrow("INVALID_LOCAL_TIME_GAP");
    expect(() => resolveLocalDateTime("2024-10-27", "02:30", "Europe/Rome")).toThrow("INVALID_LOCAL_TIME_OVERLAP");
    expect(resolveLocalDateTime("2024-10-27", "02:30", "Europe/Rome", "earlier")).toBe("2024-10-27T00:30:00.000Z");
    expect(resolveLocalDateTime("2024-10-27", "02:30", "Europe/Rome", "later")).toBe("2024-10-27T01:30:00.000Z");
  });

  it("finds the shared working window on a home-local date", () => {
    expect(findTimezoneOverlap({
      date: "2026-09-23",
      homeTimeZone: "Europe/Rome",
      otherTimeZone: "America/New_York",
      homeWorkingHours: { start: "09:00", end: "17:00" },
      otherWorkingHours: { start: "09:00", end: "17:00" },
    })).toEqual({
      segments: [{
        startInstant: "2026-09-23T13:00:00.000Z",
        endInstant: "2026-09-23T15:00:00.000Z",
        home: "2026-09-23 15:00–17:00",
        other: "2026-09-23 09:00–11:00",
      }],
      assumptions: {
        dateBasis: "home-local-date",
        boundaries: "same-day-working-hours",
        ambiguousBoundaryPolicy: "reject",
        nonexistentBoundaryPolicy: "reject",
      },
    });
  });
});
