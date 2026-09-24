import { addCalendarDays } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, integerValue, stringValue } from "../date-time/module-utils";
import type { AddSubtractDaysToolInput, AddSubtractDaysToolOutput } from "../date-time/types";

function validateInput(value: unknown): AddSubtractDaysToolInput {
  const record = asRecord(value);
  const startDate = stringValue(record, "startDate");
  const amount = record.amount === undefined ? integerValue(record, "days") : integerValue(record, "amount");
  return { startDate, amount };
}

const module: ToolModule = {
  run(rawInput, _context, signal): AddSubtractDaysToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    return { startDate: input.startDate, amount: input.amount, resultDate: addCalendarDays(input.startDate, input.amount), basis: "calendar-day" };
  },
};

export default module;
