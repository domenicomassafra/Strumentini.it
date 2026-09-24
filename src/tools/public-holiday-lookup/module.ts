import { lookupPublicHolidays } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, integerValue, stringValue } from "../date-time/module-utils";
import type { PublicHolidayToolInput, PublicHolidayToolOutput } from "../date-time/types";

function validateInput(value: unknown): PublicHolidayToolInput {
  const record = asRecord(value);
  return { country: stringValue(record, "country"), year: integerValue(record, "year") };
}

const module: ToolModule = {
  run(rawInput, _context, signal): PublicHolidayToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    return lookupPublicHolidays(input.country, input.year);
  },
};

export default module;
