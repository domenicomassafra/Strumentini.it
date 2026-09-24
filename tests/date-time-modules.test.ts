import { describe, expect, it } from "vitest";
import addSubtractDays from "../src/tools/add-subtract-days/module";
import ageDateAnniversary from "../src/tools/age-date-anniversary/module";
import businessDay from "../src/tools/business-day/module";
import calendarDateListGenerator from "../src/tools/calendar-date-list-generator/module";
import dateDifference from "../src/tools/date-difference/module";
import deadlineCountdown from "../src/tools/deadline-countdown/module";
import decimalHoursConverter from "../src/tools/decimal-hours-converter/module";
import durationCalculator from "../src/tools/duration-calculator/module";
import epochBatchConverter from "../src/tools/epoch-batch-converter/module";
import icsEventBuilder from "../src/tools/ics-event-builder/module";
import icsViewer from "../src/tools/ics-viewer/module";
import meetingTimePlanner from "../src/tools/meeting-time-planner/module";
import publicHolidayLookup from "../src/tools/public-holiday-lookup/module";
import quarterDateMapper from "../src/tools/quarter-date-mapper/module";
import recurringDateGenerator from "../src/tools/recurring-date-generator/module";
import timesheetTotaler from "../src/tools/timesheet-totaler/module";
import timezoneConverter from "../src/tools/timezone-converter/module";
import timezoneOverlap from "../src/tools/timezone-overlap/module";
import weekNumberConverter from "../src/tools/week-number-converter/module";
import workingHours from "../src/tools/working-hours/module";

const context = { defaults: { timezone: { field: "timezone", value: "UTC", provenance: "profile" as const }, locale: { field: "locale", value: "en-US", provenance: "profile" as const } } };

describe("date/time/planning tool modules", () => {
  it("keeps the existing business-day and timezone-overlap routes executable", () => {
    expect(businessDay.run({ mode: "add", startDate: "2026-09-18", amount: 1, workweek: ["MON", "TUE", "WED", "THU", "FRI"] }, context)).toMatchObject({ resultDate: "2026-09-21" });
    expect(timezoneOverlap.run({ date: "2026-09-23", otherTimeZone: "America/New_York", otherWorkingHours: { start: "09:00", end: "17:00" } }, { defaults: { timezone: { field: "timezone", value: "Europe/Rome", provenance: "profile" }, workingHours: { field: "workingHours", value: { start: "09:00", end: "17:00" }, provenance: "tool-default" } } })).toMatchObject({ segments: [{ startInstant: "2026-09-23T13:00:00.000Z" }] });
  });

  it("executes date, offset, duration, and timezone modules", () => {
    expect(dateDifference.run({ start: "2024-03-01", end: "2024-02-28" }, context)).toMatchObject({ days: -2 });
    expect(addSubtractDays.run({ startDate: "2024-02-28", amount: 1 }, context)).toMatchObject({ resultDate: "2024-02-29" });
    expect(workingHours.run({ start: "2024-01-15T09:00:00Z", end: "2024-01-15T17:30:00Z", timeZone: "UTC" }, context)).toMatchObject({ decimalHours: "8.5" });
    expect(durationCalculator.run({ start: "2024-01-15T09:00:00Z", end: "2024-01-15T10:00:00Z", timeZone: "UTC" }, context)).toMatchObject({ hours: 1 });
    expect(timezoneConverter.run({ value: "2024-01-15T12:00:00Z", sourceTimeZone: "UTC", targetTimeZone: "Europe/Rome" }, context)).toMatchObject({ target: "2024-01-15T13:00:00+01:00" });
  });

  it("executes planning and calendar modules", () => {
    expect(meetingTimePlanner.run({ date: "2026-09-23", durationMinutes: 60, participants: [{ timeZone: "Europe/Rome", workingHours: { start: "09:00", end: "17:00" } }, { timeZone: "America/New_York", workingHours: { start: "09:00", end: "17:00" } }] }, context)).toMatchObject({ windows: expect.any(Array) });
    expect(decimalHoursConverter.run({ direction: "time-to-decimal", value: "01:30" }, context)).toMatchObject({ decimalHours: "1.5" });
    expect(timesheetTotaler.run({ entries: [{ date: "2024-01-15", start: "09:00", end: "17:30", breakMinutes: 30 }] }, context)).toMatchObject({ totalDecimalHours: "8" });
    expect(weekNumberConverter.run({ direction: "date-to-week", date: "2021-01-01", weekSystem: "iso" }, context)).toMatchObject({ weekYear: 2020, week: 53 });
    expect(quarterDateMapper.run({ direction: "date-to-quarter", date: "2024-02-29" }, context)).toMatchObject({ quarter: 1, days: 91 });
    expect(deadlineCountdown.run({ deadline: "2024-01-02T00:00:00Z", reference: "2024-01-01T00:00:00Z" }, context)).toMatchObject({ status: "remaining" });
  });

  it("executes recurrence, age, list, ICS, epoch, and holiday modules", () => {
    expect(recurringDateGenerator.run({ startDate: "2024-01-31", count: 3, frequency: "monthly" }, context)).toMatchObject({ dates: ["2024-01-31", "2024-03-31", "2024-05-31"] });
    expect(ageDateAnniversary.run({ birthDate: "2000-02-29", asOfDate: "2025-02-28" }, context)).toMatchObject({ years: 24, nextAnniversary: "2025-02-28" });
    expect(calendarDateListGenerator.run({ startDate: "2024-01-01", endDate: "2024-01-05", stepDays: 2 }, context)).toMatchObject({ dates: ["2024-01-01", "2024-01-03", "2024-01-05"] });
    const built = icsEventBuilder.run({ uid: "module-event", summary: "Review", start: "2024-01-15T12:00:00Z", end: "2024-01-15T13:00:00Z" }, context) as { text: string };
    expect(icsViewer.run({ text: built.text }, context)).toMatchObject({ events: [{ uid: "module-event" }] });
    expect(epochBatchConverter.run({ values: ["0"], unit: "seconds", timeZone: "UTC" }, context)).toMatchObject({ rows: [{ iso: "1970-01-01T00:00:00.000Z" }] });
    expect(publicHolidayLookup.run({ country: "US", year: 2026 }, context)).toMatchObject({ source: "embedded-calendar-v1" });
  });

  it("normalizes invalid module input instead of returning a fake result", () => {
    expect(() => dateDifference.run({ start: "not-a-date", end: "2024-01-01" }, context)).toThrow("INVALID_DATE");
    expect(() => icsViewer.run({ text: "BEGIN:VCALENDAR\nEND:VCALENDAR" }, context)).toThrow("INVALID_ICS");
  });
});
