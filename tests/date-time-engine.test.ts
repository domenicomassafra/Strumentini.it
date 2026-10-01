import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  buildIcsEvent,
  calculateAge,
  calculateWorkingDuration,
  calendarDateList,
  convertEpochBatch,
  convertTimeZone,
  dateToWeekNumber,
  deadlineCountdown,
  decimalHoursToTime,
  differenceBetween,
  differenceInCalendarDays,
  findMeetingWindows,
  generateRecurringDates,
  inspectIcs,
  lookupPublicHolidays,
  quarterForDate,
  quarterForNumber,
  timeToDecimalHours,
  totalTimesheet,
  weekNumberToDate,
} from "../src/engines/date-time";

describe("date/time/planning engine", () => {
  it("matches independent date arithmetic vectors across leap and year boundaries", () => {
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addCalendarDays("2024-02-28", 2)).toBe("2024-03-01");
    expect(addCalendarDays("2023-12-31", 1)).toBe("2024-01-01");
    expect(differenceInCalendarDays("2024-03-01", "2024-02-28")).toBe(2);
    expect(differenceBetween("2024-03-01", "2024-02-28")).toMatchObject({ days: -2, direction: "backward", basis: "calendar-date" });
  });

  it("preserves instant semantics and converts timezones with DST rules", () => {
    expect(differenceBetween("2024-01-15T12:00:00Z", "2024-01-15T13:30:00Z")).toMatchObject({ days: 0, hours: 1, minutes: 30, basis: "instant" });
    expect(convertTimeZone("2024-01-15T12:00:00Z", "UTC", "Europe/Rome")).toMatchObject({ instant: "2024-01-15T12:00:00.000Z", target: "2024-01-15T13:00:00+01:00" });
    expect(convertTimeZone("2024-07-15T12:00:00Z", "UTC", "Europe/Rome").target).toBe("2024-07-15T14:00:00+02:00");
    expect(() => convertTimeZone("2024-03-31T02:30", "Europe/Rome", "UTC")).toThrow("INVALID_LOCAL_TIME_GAP");
    expect(convertTimeZone("2024-10-27T02:30", "Europe/Rome", "UTC", "earlier").instant).toBe("2024-10-27T00:30:00.000Z");
    expect(convertTimeZone("2024-10-27T02:30", "Europe/Rome", "UTC", "later").instant).toBe("2024-10-27T01:30:00.000Z");
  });

  it("calculates elapsed work duration and shared meeting windows", () => {
    expect(calculateWorkingDuration("2024-01-15T09:00:00Z", "2024-01-15T17:30:00Z")).toMatchObject({ hours: 8, minutes: 510, decimalHours: "8.5" });
    const windows = findMeetingWindows({
      date: "2026-09-23",
      durationMinutes: 60,
      participants: [
        { timeZone: "Europe/Rome", workingHours: { start: "09:00", end: "17:00" } },
        { timeZone: "America/New_York", workingHours: { start: "09:00", end: "17:00" } },
      ],
    });
    expect(windows[0]).toMatchObject({ startInstant: "2026-09-23T13:00:00.000Z", endInstant: "2026-09-23T14:00:00.000Z" });
  });

  it("keeps decimal hours and timesheet arithmetic exact", () => {
    expect(timeToDecimalHours("01:30")).toBe("1.5");
    expect(decimalHoursToTime("1.1")).toMatchObject({ time: "01:06", minutes: 66, seconds: 3960, decimalHours: "1.1" });
    expect(() => decimalHoursToTime("-1")).toThrow("INVALID_DECIMAL_HOURS");
    expect(totalTimesheet([
      { date: "2024-01-15", start: "09:00", end: "17:30", breakMinutes: 30 },
      { date: "2024-01-16", start: "09:00", end: "17:00", breakMinutes: 30 },
    ])).toMatchObject({ totalMinutes: 930, totalDecimalHours: "15.5", byDate: { "2024-01-15": 480, "2024-01-16": 450 } });
  });

  it("maps dates, weeks, quarters, countdowns, and recurring series", () => {
    expect(dateToWeekNumber("2021-01-01")).toMatchObject({ weekYear: 2020, week: 53, weekday: 5 });
    expect(weekNumberToDate(2020, 53)).toBe("2020-12-28");
    expect(weekNumberToDate(2021, 1)).toBe("2021-01-04");
    expect(quarterForDate("2024-02-29")).toMatchObject({ quarter: 1, startDate: "2024-01-01", endDate: "2024-03-31", days: 91 });
    expect(quarterForNumber(2024, 4)).toMatchObject({ startDate: "2024-10-01", endDate: "2024-12-31" });
    expect(deadlineCountdown("2024-01-02T00:00:00Z", "2024-01-01T00:00:00Z")).toMatchObject({ days: 1, status: "remaining" });
    expect(generateRecurringDates({ startDate: "2024-01-31", count: 3, frequency: "monthly" }).dates).toEqual(["2024-01-31", "2024-03-31", "2024-05-31"]);
    expect(generateRecurringDates({ startDate: "2024-01-31", count: 3, frequency: "monthly", monthOverflowPolicy: "clamp" }).dates).toEqual(["2024-01-31", "2024-02-29", "2024-03-31"]);
    expect(generateRecurringDates({ startDate: "2024-01-15", count: 3, frequency: "weekly", interval: 2 }).dates).toEqual(["2024-01-15", "2024-01-29", "2024-02-12"]);
  });

  it("calculates age, date lists, and epoch batches", () => {
    expect(calculateAge("2000-02-29", "2025-02-28")).toMatchObject({ years: 24, months: 11, days: 30, nextAnniversary: "2025-02-28", daysUntilAnniversary: 0 });
    expect(calendarDateList("2024-01-01", "2024-01-05", 2).dates).toEqual(["2024-01-01", "2024-01-03", "2024-01-05"]);
    expect(convertEpochBatch(["0", "-1", "bad"], "seconds", "UTC").rows).toEqual([
      { input: "0", ok: true, epochMilliseconds: 0, iso: "1970-01-01T00:00:00.000Z", local: "1970-01-01T00:00:00+00:00" },
      { input: "-1", ok: true, epochMilliseconds: -1000, iso: "1969-12-31T23:59:59.000Z", local: "1969-12-31T23:59:59+00:00" },
      { input: "bad", ok: false, error: "INVALID_EPOCH" },
    ]);
  });

  it("builds and inspects valid ICS text while rejecting invalid date forms", () => {
    const built = buildIcsEvent({ uid: "review-1", summary: "Review, phase 1", start: "2024-01-15T12:00:00Z", end: "2024-01-15T13:00:00Z", description: "Line one\nLine two" });
    expect(built.text).toContain("SUMMARY:Review\\, phase 1");
    expect(built.text).toContain("DTSTART:20240115T120000Z");
    expect(inspectIcs(built.text).events[0]).toMatchObject({ uid: "review-1", start: "2024-01-15T12:00:00Z", allDay: false });
    expect(() => inspectIcs(built.text.replace("DTSTART:20240115T120000Z", "DTSTART:2024-01-15T12:00:00Z"))).toThrow("INVALID_ICS_DATE_TIME");
    expect(() => inspectIcs("BEGIN:VCALENDAR\nEND:VCALENDAR")).toThrow("INVALID_ICS");
  });

  it("returns a deterministic embedded holiday calendar", () => {
    const result = lookupPublicHolidays("US", 2026);
    expect(result.source).toBe("embedded-calendar-v1");
    expect(result.holidays).toContainEqual(expect.objectContaining({ date: "2026-07-03", name: "Giorno dell'Indipendenza", observed: true, actualDate: "2026-07-04" }));
    expect(result.holidays).toContainEqual({ date: "2026-11-26", name: "Giorno del Ringraziamento", observed: false });
    expect(() => lookupPublicHolidays("ZZ", 2026)).toThrow("INVALID_COUNTRY");
  });
});
