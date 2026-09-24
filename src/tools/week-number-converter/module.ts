import { dateToWeekNumber, weekNumberToDate } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, integerValue, stringValue } from "../date-time/module-utils";
import type { WeekNumberToolInput, WeekNumberToolOutput } from "../date-time/types";

function validateInput(value: unknown): WeekNumberToolInput {
  const record = asRecord(value);
  const direction = record.direction ?? (record.date === undefined ? "week-to-date" : "date-to-week");
  if (direction !== "date-to-week" && direction !== "week-to-date") throw new Error("INVALID_DIRECTION");
  const weekSystem = record.weekSystem ?? "iso";
  if (weekSystem !== "iso" && weekSystem !== "us") throw new Error("INVALID_WEEK_SYSTEM");
  if (direction === "date-to-week") return { date: stringValue(record, "date"), weekSystem, direction };
  return { weekYear: integerValue(record, "weekYear"), week: integerValue(record, "week"), weekSystem, direction };
}

const module: ToolModule = {
  run(rawInput, _context, signal): WeekNumberToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    if (input.direction === "week-to-date") {
      const date = weekNumberToDate(input.weekYear!, input.week!, input.weekSystem);
      const result = dateToWeekNumber(date, input.weekSystem);
      return { ...result, date };
    }
    return dateToWeekNumber(input.date!, input.weekSystem);
  },
};

export default module;
