import { decimalHoursToTime, timeToDecimalHours } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, stringValue } from "../date-time/module-utils";
import type { DecimalHoursToolInput, DecimalHoursToolOutput } from "../date-time/types";

function validateInput(value: unknown): DecimalHoursToolInput {
  const record = asRecord(value);
  const direction = record.direction;
  if (direction !== "time-to-decimal" && direction !== "decimal-to-time") throw new Error("INVALID_DIRECTION");
  return { value: stringValue(record, "value"), direction };
}

const module: ToolModule = {
  run(rawInput, _context, signal): DecimalHoursToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    if (input.direction === "time-to-decimal") return { input: input.value, direction: input.direction, decimalHours: timeToDecimalHours(input.value) };
    const result = decimalHoursToTime(input.value);
    return { input: input.value, direction: input.direction, decimalHours: result.decimalHours, time: result.time, minutes: result.minutes, seconds: result.seconds };
  },
};

export default module;
