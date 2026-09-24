import { generateRecurringDates, type RecurrenceInput } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, integerValue, optionalString, stringValue } from "../date-time/module-utils";
import type { RecurringDateToolInput, RecurringDateToolOutput } from "../date-time/types";

function validateInput(value: unknown): RecurringDateToolInput {
  const record = asRecord(value);
  const frequency = record.frequency;
  if (frequency !== "daily" && frequency !== "weekly" && frequency !== "monthly" && frequency !== "yearly") throw new Error("INVALID_FREQUENCY");
  const weekdays = record.weekdays;
  if (weekdays !== undefined && (!Array.isArray(weekdays) || weekdays.some((day) => typeof day !== "number"))) throw new Error("INVALID_WEEKDAYS");
  return {
    startDate: stringValue(record, "startDate"),
    count: integerValue(record, "count"),
    frequency,
    ...(record.interval === undefined ? {} : { interval: integerValue(record, "interval") }),
    ...(weekdays === undefined ? {} : { weekdays: weekdays as readonly number[] }),
    ...(optionalString(record, "endDate") === undefined ? {} : { endDate: optionalString(record, "endDate")! }),
    ...(record.monthOverflowPolicy === undefined ? {} : { monthOverflowPolicy: record.monthOverflowPolicy as "skip" | "clamp" }),
  };
}

const module: ToolModule = {
  run(rawInput, _context, signal): RecurringDateToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    return { ...generateRecurringDates(input as RecurrenceInput), policy: input };
  },
};

export default module;
