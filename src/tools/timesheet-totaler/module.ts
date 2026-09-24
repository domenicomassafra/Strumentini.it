import { totalTimesheet } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, integerValue, stringValue } from "../date-time/module-utils";
import type { TimesheetToolInput, TimesheetToolOutput } from "../date-time/types";

function entryValue(value: unknown): { date: string; start: string; end: string; breakMinutes?: number } {
  const record = asRecord(value);
  return {
    date: stringValue(record, "date"),
    start: stringValue(record, "start"),
    end: stringValue(record, "end"),
    ...(record.breakMinutes === undefined ? {} : { breakMinutes: integerValue(record, "breakMinutes") }),
  };
}

function validateInput(value: unknown): TimesheetToolInput {
  const record = asRecord(value);
  if (!Array.isArray(record.entries)) throw new Error("INVALID_INPUT");
  return { entries: record.entries.map(entryValue) };
}

const module: ToolModule = {
  run(rawInput, _context, signal): TimesheetToolOutput {
    ensureNotAborted(signal);
    return totalTimesheet(validateInput(rawInput).entries);
  },
};

export default module;
