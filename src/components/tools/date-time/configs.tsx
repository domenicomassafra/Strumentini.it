import { ageDateAnniversaryManifest, addSubtractDaysManifest, calendarDateListGeneratorManifest, dateDifferenceManifest, deadlineCountdownManifest, decimalHoursConverterManifest, durationCalculatorManifest, epochBatchConverterManifest, icsEventBuilderManifest, icsViewerManifest, meetingTimePlannerManifest, publicHolidayLookupManifest, quarterDateMapperManifest, recurringDateGeneratorManifest, timesheetTotalerManifest, timezoneConverterManifest, weekNumberConverterManifest, workingHoursManifest } from "../../../date-time/manifest";
import type { IcsBuilderToolOutput } from "../../../tools/date-time/types";
import type { DateTimeField, DateTimeToolConfig } from "./DateTimeOperation";

const number = (values: Readonly<Record<string, string>>, key: string): number => Number(values[key] ?? 0);

function textField(key: string, label: string, type: DateTimeField["type"], extra: Partial<DateTimeField> = {}): DateTimeField {
  return { key, label, type, required: true, ...extra };
}

export const dateDifferenceConfig: DateTimeToolConfig = {
  tool: dateDifferenceManifest,
  fields: [
    textField("start", "Start date or instant", "text", { defaultValue: "2024-01-01", help: "Use YYYY-MM-DD or an ISO instant." }),
    textField("end", "End date or instant", "text", { defaultValue: "2024-01-08", help: "An ISO instant is compared by elapsed time." }),
    textField("timeZone", "Timezone for local date-times", "text", { defaultValue: "UTC", help: "IANA name; date-only values are calendar dates.", required: false }),
  ],
  buildInput: (values) => ({ start: values.start, end: values.end, timeZone: values.timeZone }),
  eyebrow: "Date difference",
  placeholder: "The signed difference appears here.",
  submitLabel: "Compare dates",
  resultLabel: (result) => {
    const value = result as { days?: number; direction?: string };
    return `${value.direction ?? "result"} · ${value.days ?? 0} day${Math.abs(value.days ?? 0) === 1 ? "" : "s"}`;
  },
};

export const addSubtractDaysConfig: DateTimeToolConfig = {
  tool: addSubtractDaysManifest,
  fields: [
    textField("startDate", "Start date", "date"),
    textField("amount", "Days to add", "number", { step: "1", defaultValue: "1", help: "Use a negative number to subtract." }),
  ],
  buildInput: (values) => ({ startDate: values.startDate, amount: number(values, "amount") }),
  eyebrow: "Shifted date",
  placeholder: "The resulting calendar date appears here.",
  submitLabel: "Shift date",
  resultLabel: (result) => String((result as { resultDate?: string }).resultDate ?? ""),
};

export const workingHoursConfig: DateTimeToolConfig = {
  tool: workingHoursManifest,
  fields: [
    textField("start", "Start", "text", { defaultValue: "2024-01-15T09:00", help: "Local date-time without an offset is resolved in the selected timezone." }),
    textField("end", "End", "text", { defaultValue: "2024-01-15T17:30" }),
    textField("timeZone", "Timezone", "text", { defaultValue: "UTC", required: false }),
  ],
  buildInput: (values) => ({ start: values.start, end: values.end, timeZone: values.timeZone }),
  eyebrow: "Elapsed work time",
  placeholder: "Duration and decimal hours appear here.",
  submitLabel: "Calculate hours",
  resultLabel: (result) => `${(result as { decimalHours?: string }).decimalHours ?? "0"} hours`,
};

export const timezoneConverterConfig: DateTimeToolConfig = {
  tool: timezoneConverterManifest,
  fields: [
    textField("value", "Date-time or instant", "text", { defaultValue: "2024-01-15T12:00:00Z" }),
    textField("sourceTimeZone", "Source timezone", "text", { defaultValue: "UTC" }),
    textField("targetTimeZone", "Target timezone", "text", { defaultValue: "Europe/Rome" }),
    textField("disambiguation", "DST overlap choice", "select", { defaultValue: "reject", options: ["reject", "earlier", "later"] }),
  ],
  buildInput: (values) => ({ value: values.value, sourceTimeZone: values.sourceTimeZone, targetTimeZone: values.targetTimeZone, disambiguation: values.disambiguation }),
  eyebrow: "Converted instant",
  placeholder: "Both timezone renderings appear here.",
  submitLabel: "Convert timezone",
  resultLabel: (result) => String((result as { target?: string }).target ?? ""),
};

export const meetingPlannerConfig: DateTimeToolConfig = {
  tool: meetingTimePlannerManifest,
  fields: [
    textField("date", "Date", "date"),
    textField("durationMinutes", "Duration in minutes", "number", { step: "15", defaultValue: "60" }),
    textField("participants", "Participants", "textarea", { defaultValue: "Europe/Rome|09:00|17:00\nAmerica/New_York|09:00|17:00", help: "One participant per line: IANA timezone|start|end." }),
    textField("limit", "Maximum windows", "number", { step: "1", defaultValue: "8" }),
  ],
  buildInput: (values) => ({
    date: values.date,
    durationMinutes: number(values, "durationMinutes"),
    limit: number(values, "limit"),
    participants: (values.participants ?? "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [timeZone, start, end] = line.split("|");
      if (timeZone === undefined || start === undefined || end === undefined) throw new Error("INVALID_INPUT");
      return { timeZone, workingHours: { start, end } };
    }),
  }),
  eyebrow: "Shared windows",
  placeholder: "Matching meeting windows appear here.",
  submitLabel: "Find meeting times",
  resultLabel: (result) => `${(result as { windows?: unknown[] }).windows?.length ?? 0} window(s)`,
};

export const durationConfig: DateTimeToolConfig = {
  tool: durationCalculatorManifest,
  fields: [
    textField("start", "Start", "text", { defaultValue: "2024-01-15T09:00:00Z" }),
    textField("end", "End", "text", { defaultValue: "2024-01-16T12:00:00Z" }),
    textField("timeZone", "Timezone for local values", "text", { defaultValue: "UTC", required: false }),
  ],
  buildInput: (values) => ({ start: values.start, end: values.end, timeZone: values.timeZone }),
  eyebrow: "Duration",
  placeholder: "Elapsed units appear here.",
  submitLabel: "Calculate duration",
  resultLabel: (result) => `${(result as { days?: number; hours?: number; minutes?: number }).days ?? 0}d ${(result as { hours?: number }).hours ?? 0}h ${(result as { minutes?: number }).minutes ?? 0}m`,
};

export const decimalHoursConfig: DateTimeToolConfig = {
  tool: decimalHoursConverterManifest,
  fields: [
    textField("direction", "Direction", "select", { defaultValue: "time-to-decimal", options: ["time-to-decimal", "decimal-to-time"] }),
    textField("value", "Value", "text", { defaultValue: "01:30" }),
  ],
  buildInput: (values) => ({ direction: values.direction, value: values.value }),
  eyebrow: "Decimal hours",
  placeholder: "The converted value appears here.",
  submitLabel: "Convert",
  resultLabel: (result) => String((result as { decimalHours?: string; time?: string }).decimalHours ?? (result as { time?: string }).time ?? ""),
};

function timesheetEntries(value: string): { date: string; start: string; end: string; breakMinutes?: number }[] {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [date, range, breaks] = line.split("|");
    if (date === undefined || range === undefined) throw new Error("INVALID_INPUT");
    const [start, end] = range.split("-");
    if (start === undefined || end === undefined) throw new Error("INVALID_INPUT");
    return { date, start, end, ...(breaks === undefined || breaks === "" ? {} : { breakMinutes: Number(breaks) }) };
  });
}

export const timesheetConfig: DateTimeToolConfig = {
  tool: timesheetTotalerManifest,
  fields: [textField("entries", "Entries", "textarea", { defaultValue: "2024-01-15|09:00|17:30|30\n2024-01-16|09:00|17:00|30", help: "One entry per line: date|start|end|optional break minutes." })],
  buildInput: (values) => ({ entries: timesheetEntries(values.entries ?? "") }),
  eyebrow: "Timesheet total",
  placeholder: "Daily and overall totals appear here.",
  submitLabel: "Total timesheet",
  resultLabel: (result) => `${(result as { totalDecimalHours?: string }).totalDecimalHours ?? "0"} hours`,
};

export const weekNumberConfig: DateTimeToolConfig = {
  tool: weekNumberConverterManifest,
  fields: [
    textField("direction", "Direction", "select", { defaultValue: "date-to-week", options: ["date-to-week", "week-to-date"] }),
    textField("date", "Date (date → week)", "date", { required: false }),
    textField("weekYear", "Week year (week → date)", "number", { defaultValue: "2024", required: false }),
    textField("week", "Week number (week → date)", "number", { defaultValue: "1", required: false }),
    textField("weekSystem", "Week system", "select", { defaultValue: "iso", options: ["iso", "us"] }),
  ],
  buildInput: (values) => values.direction === "date-to-week"
    ? { direction: values.direction, date: values.date, weekSystem: values.weekSystem }
    : { direction: values.direction, weekYear: number(values, "weekYear"), week: number(values, "week"), weekSystem: values.weekSystem },
  eyebrow: "Week number",
  placeholder: "The week mapping appears here.",
  submitLabel: "Convert week",
  resultLabel: (result) => `${(result as { weekYear?: number; week?: number }).weekYear ?? ""}-W${String((result as { week?: number }).week ?? "").padStart(2, "0")}`,
};

export const quarterConfig: DateTimeToolConfig = {
  tool: quarterDateMapperManifest,
  fields: [
    textField("direction", "Direction", "select", { defaultValue: "date-to-quarter", options: ["date-to-quarter", "quarter-to-dates"] }),
    textField("date", "Date (date → quarter)", "date", { required: false }),
    textField("year", "Year (quarter → dates)", "number", { defaultValue: "2024", required: false }),
    textField("quarter", "Quarter (quarter → dates)", "number", { defaultValue: "1", required: false }),
  ],
  buildInput: (values) => values.direction === "date-to-quarter" ? { direction: values.direction, date: values.date } : { direction: values.direction, year: number(values, "year"), quarter: number(values, "quarter") },
  eyebrow: "Calendar quarter",
  placeholder: "Quarter boundaries appear here.",
  submitLabel: "Map quarter",
  resultLabel: (result) => `Q${(result as { quarter?: number }).quarter ?? ""} ${(result as { year?: number }).year ?? ""}`,
};

export const deadlineConfig: DateTimeToolConfig = {
  tool: deadlineCountdownManifest,
  fields: [
    textField("deadline", "Deadline", "text", { defaultValue: "2024-01-08T17:00:00Z" }),
    textField("reference", "Reference time", "text", { defaultValue: "2024-01-01T09:00:00Z" }),
  ],
  buildInput: (values) => ({ deadline: values.deadline, reference: values.reference }),
  eyebrow: "Deadline countdown",
  placeholder: "The remaining duration appears here.",
  submitLabel: "Count down",
  resultLabel: (result) => `${(result as { status?: string }).status ?? ""} · ${(result as { days?: number }).days ?? 0} day(s)`,
};

export const recurrenceConfig: DateTimeToolConfig = {
  tool: recurringDateGeneratorManifest,
  fields: [
    textField("startDate", "Start date", "date"),
    textField("count", "Occurrences", "number", { defaultValue: "5" }),
    textField("frequency", "Frequency", "select", { defaultValue: "monthly", options: ["daily", "weekly", "monthly", "yearly"] }),
    textField("interval", "Interval", "number", { defaultValue: "1" }),
    textField("weekdays", "Weekdays (optional CSV 0–6)", "text", { placeholder: "1,3,5", required: false }),
    textField("endDate", "End date (optional)", "date", { required: false }),
    textField("monthOverflowPolicy", "Month overflow", "select", { defaultValue: "skip", options: ["skip", "clamp"] }),
  ],
  buildInput: (values) => ({
    startDate: values.startDate,
    count: number(values, "count"),
    frequency: values.frequency,
    interval: number(values, "interval"),
    ...((values.weekdays ?? "").trim() === "" ? {} : { weekdays: (values.weekdays ?? "").split(",").map((day) => Number(day.trim())) }),
    ...(values.endDate === "" ? {} : { endDate: values.endDate }),
    monthOverflowPolicy: values.monthOverflowPolicy,
  }),
  eyebrow: "Date series",
  placeholder: "Generated dates appear here.",
  submitLabel: "Generate dates",
  resultLabel: (result) => `${(result as { dates?: unknown[] }).dates?.length ?? 0} date(s)`,
};

export const ageConfig: DateTimeToolConfig = {
  tool: ageDateAnniversaryManifest,
  fields: [textField("birthDate", "Birth/start date", "date"), textField("asOfDate", "As-of date", "date")],
  buildInput: (values) => ({ birthDate: values.birthDate, asOfDate: values.asOfDate }),
  eyebrow: "Age and anniversary",
  placeholder: "Age components appear here.",
  submitLabel: "Calculate age",
  resultLabel: (result) => `${(result as { years?: number }).years ?? 0} years · next ${(result as { nextAnniversary?: string }).nextAnniversary ?? ""}`,
};

export const calendarListConfig: DateTimeToolConfig = {
  tool: calendarDateListGeneratorManifest,
  fields: [textField("startDate", "Start date", "date"), textField("endDate", "End date", "date"), textField("stepDays", "Step in days", "number", { defaultValue: "1" })],
  buildInput: (values) => ({ startDate: values.startDate, endDate: values.endDate, stepDays: number(values, "stepDays") }),
  eyebrow: "Date list",
  placeholder: "The calendar list appears here.",
  submitLabel: "Generate list",
  resultLabel: (result) => `${(result as { dates?: unknown[] }).dates?.length ?? 0} date(s)`,
};

export const icsBuilderConfig: DateTimeToolConfig = {
  tool: icsEventBuilderManifest,
  fields: [
    textField("summary", "Event title", "text", { defaultValue: "Project review" }),
    textField("start", "Start", "text", { defaultValue: "2024-01-15T12:00:00Z" }),
    textField("end", "End", "text", { defaultValue: "2024-01-15T13:00:00Z" }),
    textField("allDay", "All-day", "select", { defaultValue: "false", options: ["false", "true"] }),
    textField("timeZone", "Timezone for local values", "text", { defaultValue: "UTC", required: false }),
    textField("description", "Description", "textarea", { required: false }),
    textField("location", "Location", "text", { required: false }),
  ],
  buildInput: (values) => ({ summary: values.summary, start: values.start, end: values.end, allDay: values.allDay === "true", timeZone: values.timeZone, ...(values.description === "" ? {} : { description: values.description }), ...(values.location === "" ? {} : { location: values.location }) }),
  eyebrow: "ICS event",
  placeholder: "The RFC 5545 event appears here.",
  submitLabel: "Build ICS event",
  download: { name: "event.ics", mimeType: "text/calendar;charset=utf-8", value: (result) => (result as IcsBuilderToolOutput).text },
  resultLabel: () => "Valid local ICS text",
};

export const icsViewerConfig: DateTimeToolConfig = {
  tool: icsViewerManifest,
  fields: [textField("text", "ICS text", "textarea", { defaultValue: "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:example\nDTSTART:20240115T120000Z\nSUMMARY:Review\nEND:VEVENT\nEND:VCALENDAR" })],
  buildInput: (values) => ({ text: values.text }),
  eyebrow: "ICS inspection",
  placeholder: "The parsed event structure appears here.",
  submitLabel: "Inspect ICS",
  resultLabel: (result) => `${(result as { events?: unknown[] }).events?.length ?? 0} event(s)`,
};

export const epochConfig: DateTimeToolConfig = {
  tool: epochBatchConverterManifest,
  fields: [textField("values", "Epoch values", "textarea", { defaultValue: "0\n-1\n1700000000" }), textField("unit", "Input unit", "select", { defaultValue: "seconds", options: ["seconds", "milliseconds"] }), textField("timeZone", "Display timezone", "text", { defaultValue: "UTC" })],
  buildInput: (values) => ({ values: (values.values ?? "").split(/\r?\n/u).map((value) => value.trim()).filter(Boolean), unit: values.unit, timeZone: values.timeZone }),
  eyebrow: "Epoch conversion",
  placeholder: "Converted rows appear here.",
  submitLabel: "Convert batch",
  resultLabel: (result) => `${(result as { rows?: unknown[] }).rows?.length ?? 0} row(s)`,
};

export const holidayConfig: DateTimeToolConfig = {
  tool: publicHolidayLookupManifest,
  fields: [textField("country", "Country", "select", { defaultValue: "US", options: ["US", "CA", "GB", "IT"] }), textField("year", "Year", "number", { defaultValue: "2026" })],
  buildInput: (values) => ({ country: values.country, year: number(values, "year") }),
  eyebrow: "Public holidays",
  placeholder: "The embedded calendar appears here.",
  submitLabel: "Look up holidays",
  resultLabel: (result) => `${(result as { holidays?: unknown[] }).holidays?.length ?? 0} holiday(s)`,
};
