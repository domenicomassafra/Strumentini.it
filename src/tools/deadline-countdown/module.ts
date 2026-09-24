import { deadlineCountdown } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, stringValue } from "../date-time/module-utils";
import type { DeadlineToolInput, DeadlineToolOutput } from "../date-time/types";

function validateInput(value: unknown): DeadlineToolInput {
  const record = asRecord(value);
  return { deadline: stringValue(record, "deadline"), reference: stringValue(record, "reference") };
}

const module: ToolModule = {
  run(rawInput, _context, signal): DeadlineToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    return deadlineCountdown(input.deadline, input.reference);
  },
};

export default module;
