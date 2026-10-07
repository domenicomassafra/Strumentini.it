import { calendarDateList, calendarWeekday, isGregorianLeapYear, printableMonthCalendar } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, integerValue, stringValue } from "../date-time/module-utils";
import type { CalendarDateListToolInput, CalendarDateListToolOutput } from "../date-time/types";

function validateInput(value: unknown): CalendarDateListToolInput {
  const record = asRecord(value);
  const mode = typeof record.mode === "string" ? record.mode : "date-list";
  if (mode === "date-list") return { mode, startDate: stringValue(record, "startDate"), endDate: stringValue(record, "endDate"), stepDays: integerValue(record, "stepDays") };
  if (mode === "weekday") return { mode, date: stringValue(record, "date") };
  if (mode === "leap-year") return { mode, year: integerValue(record, "year") };
  if (mode === "month") return { mode, year: integerValue(record, "year"), month: integerValue(record, "month") };
  throw new Error("INVALID_MODE");
}

const module: ToolModule = {
  run(rawInput, _context, signal): CalendarDateListToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    if (input.mode === "weekday") return calendarWeekday(input.date);
    if (input.mode === "leap-year") return { year: input.year, leapYear: isGregorianLeapYear(input.year), calendar: "proleptic-gregorian" };
    if (input.mode === "month") return printableMonthCalendar(input.year, input.month);
    return calendarDateList(input.startDate, input.endDate, input.stepDays);
  },
};

export default module;
