import { quarterForDate, quarterForNumber } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, integerValue, stringValue } from "../date-time/module-utils";
import type { QuarterToolInput, QuarterToolOutput } from "../date-time/types";

function validateInput(value: unknown): QuarterToolInput {
  const record = asRecord(value);
  const direction = record.direction ?? (record.date === undefined ? "quarter-to-dates" : "date-to-quarter");
  if (direction !== "date-to-quarter" && direction !== "quarter-to-dates") throw new Error("INVALID_DIRECTION");
  if (direction === "date-to-quarter") return { date: stringValue(record, "date"), direction };
  return { year: integerValue(record, "year"), quarter: integerValue(record, "quarter"), direction };
}

const module: ToolModule = {
  run(rawInput, _context, signal): QuarterToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    return input.direction === "date-to-quarter" ? quarterForDate(input.date!) : quarterForNumber(input.year!, input.quarter!);
  },
};

export default module;
