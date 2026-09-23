import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  businessDaysBetween,
  type DayCode,
} from "../src/engines/date-time/business-days";

const fixtures = JSON.parse(
  readFileSync(new URL("../quality/fixtures/business-days/vectors.json", import.meta.url), "utf8"),
) as {
  policy: { working_days: DayCode[] };
  vectors: Array<Record<string, string | number | string[]>>;
};

describe("business-day engine seam", () => {
  it("matches independent Gold vectors", () => {
    const calendar = { workweek: fixtures.policy.working_days };
    for (const vector of fixtures.vectors) {
      const excludedDates = vector.excluded_dates as string[] | undefined;
      const vectorCalendar = excludedDates === undefined
        ? { workweek: (vector.working_days as DayCode[] | undefined) ?? calendar.workweek }
        : {
            workweek: (vector.working_days as DayCode[] | undefined) ?? calendar.workweek,
            excludedDates,
          };
      if ("add_business_days" in vector) {
        expect(addBusinessDays(String(vector.start), Number(vector.add_business_days), vectorCalendar)).toBe(vector.expected);
      } else {
        expect(businessDaysBetween(String(vector.start), String(vector.business_days_until), vectorCalendar)).toBe(vector.expected);
      }
    }
  });

  it("handles leap/month boundaries with a custom workweek", () => {
    expect(
      addBusinessDays("2028-02-28", 2, { workweek: ["MON", "TUE", "WED", "THU"] }),
    ).toBe("2028-03-01");
  });

  it("skips explicit excluded dates", () => {
    expect(
      addBusinessDays("2026-12-23", 2, {
        workweek: ["MON", "TUE", "WED", "THU", "FRI"],
        excludedDates: ["2026-12-25"],
      }),
    ).toBe("2026-12-28");
  });

  it("rejects invalid dates and an empty workweek", () => {
    expect(() => addBusinessDays("2026-02-30", 1, { workweek: ["MON"] })).toThrow("INVALID_DATE");
    expect(() => addBusinessDays("2026-09-23", 1, { workweek: [] })).toThrow("INVALID_WORKWEEK");
  });
});
