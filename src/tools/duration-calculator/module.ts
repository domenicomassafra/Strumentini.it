import { calculateWorkingDuration } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, defaultValue, ensureNotAborted, optionalString, stringValue } from "../date-time/module-utils";
import type { DurationToolInput, DurationToolOutput } from "../date-time/types";

function validateInput(value: unknown, defaultTimeZone: string | undefined): DurationToolInput {
  const record = asRecord(value);
  const timeZone = optionalString(record, "timeZone") ?? defaultTimeZone;
  return { start: stringValue(record, "start"), end: stringValue(record, "end"), ...(timeZone === undefined ? {} : { timeZone }) };
}

const module: ToolModule = {
  run(rawInput, context, signal): DurationToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput, defaultValue<string>(context, "timezone"));
    return calculateWorkingDuration(input.start, input.end, input.timeZone);
  },
};

export default module;
