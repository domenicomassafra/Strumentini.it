import { calculateAge } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, stringValue } from "../date-time/module-utils";
import type { AgeToolInput, AgeToolOutput } from "../date-time/types";

function validateInput(value: unknown): AgeToolInput {
  const record = asRecord(value);
  return { birthDate: stringValue(record, "birthDate"), asOfDate: stringValue(record, "asOfDate") };
}

const module: ToolModule = {
  run(rawInput, _context, signal): AgeToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    return calculateAge(input.birthDate, input.asOfDate);
  },
};

export default module;
