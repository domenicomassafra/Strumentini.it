import { convertEpochBatch } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, defaultValue, ensureNotAborted, optionalString } from "../date-time/module-utils";
import type { EpochBatchToolInput, EpochBatchToolOutput } from "../date-time/types";

function validateInput(value: unknown, defaultTimeZone: string | undefined): EpochBatchToolInput {
  const record = asRecord(value);
  if (!Array.isArray(record.values) || record.values.some((item) => typeof item !== "string")) throw new Error("INVALID_INPUT");
  const unit = record.unit ?? "seconds";
  if (unit !== "seconds" && unit !== "milliseconds") throw new Error("INVALID_UNIT");
  const timeZone = optionalString(record, "timeZone") ?? defaultTimeZone ?? "UTC";
  return { values: record.values as readonly string[], unit, timeZone };
}

const module: ToolModule = {
  run(rawInput, context, signal): EpochBatchToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput, defaultValue<string>(context, "timezone"));
    return convertEpochBatch(input.values, input.unit, input.timeZone);
  },
};

export default module;
