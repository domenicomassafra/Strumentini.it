import { calculateWorkingDuration } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, defaultValue, ensureNotAborted, optionalString, stringValue } from "../date-time/module-utils";
import type { WorkingHoursToolInput, WorkingHoursToolOutput } from "../date-time/types";

function timeValue(record: Record<string, unknown>, dateKey: string, timeKey: string): string {
  const date = stringValue(record, dateKey);
  const time = stringValue(record, timeKey);
  return `${date}T${time}`;
}

function validateInput(value: unknown, defaultTimeZone: string | undefined): WorkingHoursToolInput {
  const record = asRecord(value);
  const start = record.start === undefined ? timeValue(record, "startDate", "startTime") : stringValue(record, "start");
  const end = record.end === undefined ? timeValue(record, "endDate", "endTime") : stringValue(record, "end");
  const timeZone = optionalString(record, "timeZone") ?? defaultTimeZone;
  return { start, end, ...(timeZone === undefined ? {} : { timeZone }) };
}

const module: ToolModule = {
  run(rawInput, context, signal): WorkingHoursToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput, defaultValue<string>(context, "timezone"));
    return calculateWorkingDuration(input.start, input.end, input.timeZone);
  },
};

export default module;
