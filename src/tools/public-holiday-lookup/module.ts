import { lookupPublicHolidays } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, stringValue } from "../date-time/module-utils";
import type { PublicHolidayToolInput, PublicHolidayToolOutput } from "../date-time/types";

function validateInput(value: unknown): PublicHolidayToolInput {
  const record = asRecord(value);
  const country = stringValue(record, "country");
  // A year that is not a whole number is reported as a year problem, not as a
  // generic input problem, so the visitor gets the usable instruction.
  const year = record.year;
  if (typeof year !== "number" || !Number.isSafeInteger(year)) throw new Error("INVALID_YEAR");
  return { country, year };
}

const module: ToolModule = {
  run(rawInput, _context, signal): PublicHolidayToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    return lookupPublicHolidays(input.country, input.year);
  },
};

export default module;
