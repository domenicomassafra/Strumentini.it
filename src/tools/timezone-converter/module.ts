import { convertTimeZone } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, defaultValue, ensureNotAborted, optionalString, stringValue } from "../date-time/module-utils";
import type { TimezoneConverterToolInput, TimezoneConverterToolOutput } from "../date-time/types";

function validateInput(value: unknown, defaultTimeZone: string | undefined): TimezoneConverterToolInput {
  const record = asRecord(value);
  const sourceTimeZone = optionalString(record, "sourceTimeZone") ?? optionalString(record, "fromTimeZone") ?? defaultTimeZone;
  if (sourceTimeZone === undefined) throw new Error("INVALID_TIMEZONE");
  return {
    value: stringValue(record, "value"),
    sourceTimeZone,
    targetTimeZone: stringValue(record, "targetTimeZone"),
    ...(record.disambiguation === undefined ? {} : { disambiguation: record.disambiguation as "reject" | "earlier" | "later" }),
  };
}

const module: ToolModule = {
  run(rawInput, context, signal): TimezoneConverterToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput, defaultValue<string>(context, "timezone"));
    return convertTimeZone(input.value, input.sourceTimeZone, input.targetTimeZone, input.disambiguation);
  },
};

export default module;
