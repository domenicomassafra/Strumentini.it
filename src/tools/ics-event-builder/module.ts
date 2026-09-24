import { buildIcsEvent, type IcsEventInput } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, booleanValue, ensureNotAborted, optionalString, stringValue } from "../date-time/module-utils";
import type { IcsBuilderToolInput, IcsBuilderToolOutput } from "../date-time/types";

function validateInput(value: unknown): IcsBuilderToolInput {
  const record = asRecord(value);
  const input: IcsEventInput = {
    summary: stringValue(record, "summary"),
    start: stringValue(record, "start"),
    allDay: booleanValue(record, "allDay", false),
  };
  const end = optionalString(record, "end");
  const uid = optionalString(record, "uid");
  const timeZone = optionalString(record, "timeZone");
  const description = optionalString(record, "description");
  const location = optionalString(record, "location");
  return {
    ...input,
    ...(end === undefined ? {} : { end }),
    ...(uid === undefined ? {} : { uid }),
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(description === undefined ? {} : { description }),
    ...(location === undefined ? {} : { location }),
  };
}

const module: ToolModule = {
  run(rawInput, _context, signal): IcsBuilderToolOutput {
    ensureNotAborted(signal);
    return buildIcsEvent(validateInput(rawInput));
  },
};

export default module;
