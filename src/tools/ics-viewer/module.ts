import { inspectIcs } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, stringValue } from "../date-time/module-utils";
import type { IcsViewerToolInput, IcsViewerToolOutput } from "../date-time/types";

function validateInput(value: unknown): IcsViewerToolInput {
  const record = asRecord(value);
  return { text: stringValue(record, "text") };
}

const module: ToolModule = {
  run(rawInput, _context, signal): IcsViewerToolOutput {
    ensureNotAborted(signal);
    return inspectIcs(validateInput(rawInput).text);
  },
};

export default module;
