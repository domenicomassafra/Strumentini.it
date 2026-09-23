import assert from "node:assert/strict";
import {
  addBusinessDays,
  addCalendarDays,
  decimalHoursToDuration,
  differenceInCalendarDays,
  durationToDecimalHours,
} from "../src/dates.ts";

Deno.test("calendar arithmetic handles leap and year boundaries in UTC", () => {
  assert.equal(addCalendarDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addCalendarDays("2024-12-31", 1), "2025-01-01");
  assert.equal(differenceInCalendarDays("1970-01-01", "1969-12-31"), 1);
});

Deno.test("business-day arithmetic skips weekends and supports negative offsets", () => {
  assert.equal(addBusinessDays("2026-09-25", 1), "2026-09-28");
  assert.equal(addBusinessDays("2026-09-28", -1), "2026-09-25");
});

Deno.test("duration and decimal hours use exact minute rounding", () => {
  assert.equal(durationToDecimalHours({ hours: 1, minutes: 30 }), 1.5);
  assert.deepEqual(decimalHoursToDuration(1.999), { hours: 2, minutes: 0 });
});

Deno.test("invalid dates and durations are rejected", () => {
  assert.throws(() => addCalendarDays("2026-02-30", 1), /INVALID_DATE/);
  assert.throws(
    () => durationToDecimalHours({ hours: 1, minutes: 60 }),
    /INVALID_DURATION/,
  );
});
