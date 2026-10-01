import type { ToolManifest } from "../catalog/manifest";

type Entry = readonly [id: string, name: string, summary: string, aliases: readonly string[], jobs: readonly string[], inputs: readonly string[], oracle: string, fixtures: readonly string[], maintenance?: "E" | "D"];

function make(entry: Entry): ToolManifest {
  const [id, name, summary, aliases, jobs, inputTypes, oracleEntryId, fixtureFamilies, maintenanceClass = "E"] = entry;
  return {
    id,
    route: `/tools/${id}`,
    name,
    summary,
    aliases,
    jobs,
    category: "date-time",
    inputTypes,
    implementation: `../tools/${id}/module.ts`,
    engine: "date-time",
    runtime: { location: "LOCAL", network: "forbidden" },
    profileFields: [{ key: "timezone" }, { key: "locale" }],
    handoff: { accepts: [{ type: "date-time" }], emits: [{ type: "date-time" }] },
    gold: { maintenanceClass, oracleEntryId, fixtureFamilies },
  };
}

export const dateDifferenceManifest = make(["date-difference", "Date Difference", "Compare two dates or instants with explicit calendar-day and elapsed-time semantics.", ["date calculator", "days between dates", "date interval"], ["calculate date difference", "count days between dates", "compare timestamps"], ["date", "date-time"], "cand-081", ["date-arithmetic", "date-time-gold"]]);
export const addSubtractDaysManifest = make(["add-subtract-days", "Add or Subtract Days", "Shift an ISO calendar date by a signed number of days without timezone guessing.", ["date offset", "day calculator", "calendar date shift"], ["add days to date", "subtract days from date"], ["date", "number"], "cand-082", ["date-arithmetic", "date-time-gold"]]);
export const workingHoursManifest = make(["working-hours", "Working-Hours Calculator", "Calculate elapsed time between work timestamps with an explicit timezone.", ["work hours calculator", "hours worked", "shift length calculator"], ["calculate working hours", "measure work interval"], ["date", "time", "timezone"], "cand-084", ["date-arithmetic", "date-time-gold"]]);
export const timezoneConverterManifest = make(["timezone-converter", "Timezone Converter", "Convert an instant or local date-time between IANA timezones with DST-aware rules.", ["time zone converter", "UTC converter", "world clock converter"], ["convert timezone", "convert time zone", "show same time elsewhere"], ["date-time", "timezone"], "cand-085", ["timezone-dst", "date-time-gold"]]);
export const meetingTimePlannerManifest = make(["meeting-time-planner", "Meeting-Time Planner", "Find shared meeting windows across two or more timezone working-hour schedules.", ["meeting scheduler", "meeting overlap planner", "team time planner"], ["plan a meeting", "find shared meeting time", "rank distributed meeting slots"], ["date", "number", "timezone"], "cand-087", ["timezone-dst", "date-time-gold"]]);
export const durationCalculatorManifest = make(["duration-calculator", "Duration Calculator", "Measure elapsed duration between timestamps and express it in useful calendar units.", ["elapsed time calculator", "time difference", "duration between dates"], ["calculate duration", "measure elapsed time"], ["date-time", "timezone"], "cand-088", ["date-arithmetic", "date-time-gold"]]);
export const decimalHoursConverterManifest = make(["decimal-hours-converter", "Decimal-Hours Converter", "Convert exact HH:MM clock values to decimal hours and back without float rounding.", ["hours to decimal", "decimal hours to time", "time decimal converter"], ["convert decimal hours", "convert hours and minutes"], ["time", "number"], "cand-089", ["decimal-hours", "date-time-gold"]]);
export const timesheetTotalerManifest = make(["timesheet-totaler", "Timesheet Totaler", "Total daily entries, breaks, and exact decimal hours from a local timesheet.", ["timesheet calculator", "hours total", "time log totaler"], ["total timesheet", "sum work hours", "total time entries"], ["date", "time", "number"], "cand-090", ["decimal-hours", "date-time-gold"]]);
export const weekNumberConverterManifest = make(["week-number-converter", "Week-Number Converter", "Convert between calendar dates and ISO or United States week numbers.", ["week number", "ISO week", "week date converter"], ["find week number", "convert week to date", "convert date to week"], ["date", "number"], "cand-091", ["date-arithmetic", "date-time-gold"]]);
export const quarterDateMapperManifest = make(["quarter-date-mapper", "Quarter / Date Mapper", "Map a date to its calendar quarter or a quarter number to exact start and end dates.", ["quarter calculator", "fiscal quarter dates", "date to quarter"], ["map date to quarter", "find quarter dates"], ["date", "number"], "cand-092", ["date-arithmetic", "date-time-gold"]]);
export const deadlineCountdownManifest = make(["deadline-countdown", "Deadline Countdown", "Measure the exact remaining or overdue duration until a reference deadline.", ["countdown to deadline", "due date calculator", "deadline tracker"], ["count days to deadline", "calculate time remaining"], ["date", "date-time"], "cand-093", ["date-arithmetic", "date-time-gold"]]);
export const recurringDateGeneratorManifest = make(["recurring-date-generator", "Recurring-Date Generator", "Generate deterministic daily, weekly, monthly, or yearly calendar dates.", ["recurring dates", "repeat date generator", "schedule dates"], ["generate recurring dates", "create a date series"], ["date", "number"], "cand-094", ["date-arithmetic", "date-time-gold"]]);
export const ageDateAnniversaryManifest = make(["age-date-anniversary", "Age / Date Anniversary Calculator", "Calculate age components and the next anniversary from two calendar dates.", ["age calculator", "anniversary date", "years old calculator"], ["calculate age", "find next anniversary"], ["date"], "cand-095", ["date-arithmetic", "date-time-gold"]]);
export const calendarDateListGeneratorManifest = make(["calendar-date-list-generator", "Calendar Date-List Generator", "Create an inclusive, deterministic list of dates at a fixed day interval.", ["date list generator", "calendar date series", "make a date list"], ["generate a date list", "list calendar dates"], ["date", "number"], "cand-096", ["date-arithmetic", "date-time-gold"]]);
export const icsEventBuilderManifest = make(["ics-event-builder", "ICS Event Builder", "Build a deterministic RFC 5545 calendar event with folded lines and safe text escaping.", ["calendar event builder", "ICS generator", "iCalendar event"], ["build an ICS event", "create calendar file text"], ["date", "date-time", "text"], "cand-097", ["ics", "date-time-gold"]]);
export const icsViewerManifest = make(["ics-viewer", "ICS Viewer", "Inspect and validate local iCalendar text without importing or changing its content.", ["calendar file viewer", "ICS parser", "iCalendar inspector"], ["inspect an ICS file", "view calendar event text"], ["text", "file"], "cand-098", ["ics", "date-time-gold"]]);
export const epochBatchConverterManifest = make(["epoch-batch-converter", "Epoch Batch Converter", "Convert signed Unix second or millisecond values to UTC and local ISO timestamps in batches.", ["batch timestamp converter", "Unix epoch batch", "epoch to ISO"], ["convert epoch timestamps", "batch convert Unix time"], ["number", "date-time"], "cand-099", ["date-arithmetic", "date-time-gold"]]);
export const publicHolidayLookupManifest = make(["public-holiday-lookup", "Public-Holiday Lookup", "Look up deterministic embedded public-holiday calendars for selected countries and years.", ["holiday calendar", "public holiday dates", "country holidays"], ["look up public holidays", "list holidays by country"], ["date", "number"], "cand-100", ["date-arithmetic"], "D"]);
