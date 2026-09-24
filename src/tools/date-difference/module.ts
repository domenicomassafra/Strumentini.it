import { differenceBetween } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, defaultValue, ensureNotAborted, optionalString, stringValue } from "../date-time/module-utils";
import type { DateDifferenceToolInput, DateDifferenceToolOutput } from "../date-time/types";

function firstString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) if (record[key] !== undefined) return stringValue(record, key);
  throw new Error("INVALID_INPUT");
}

function validateInput(value: unknown, timeZone: string | undefined): DateDifferenceToolInput {
  const record = asRecord(value);
  const explicitTimeZone = optionalString(record, "timeZone");
  const resolvedTimeZone = explicitTimeZone ?? timeZone;
  return {
    start: firstString(record, ["start", "startDate", "from"]),
    end: firstString(record, ["end", "endDate", "to"]),
    ...(resolvedTimeZone === undefined ? {} : { timeZone: resolvedTimeZone }),
  };
}

const module: ToolModule = {
  run(rawInput, context, signal): DateDifferenceToolOutput {
    ensureNotAborted(signal);
    const timeZone = defaultValue<string>(context, "timezone");
    const input = validateInput(rawInput, timeZone);
    return differenceBetween(input.start, input.end, input.timeZone);
  },
};

export default module;
