import { calendarDateList } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, integerValue, stringValue } from "../date-time/module-utils";
import type { CalendarDateListToolInput, CalendarDateListToolOutput } from "../date-time/types";

function validateInput(value: unknown): CalendarDateListToolInput {
  const record = asRecord(value);
  return { startDate: stringValue(record, "startDate"), endDate: stringValue(record, "endDate"), stepDays: integerValue(record, "stepDays") };
}

const module: ToolModule = {
  run(rawInput, _context, signal): CalendarDateListToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    return calendarDateList(input.startDate, input.endDate, input.stepDays);
  },
};

export default module;
