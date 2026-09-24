import { findMeetingWindows, type MeetingParticipant } from "../../engines/date-time";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, integerValue, stringValue } from "../date-time/module-utils";
import type { MeetingPlannerToolInput, MeetingPlannerToolOutput } from "../date-time/types";

function participantValue(value: unknown): MeetingParticipant {
  const record = asRecord(value);
  const hours = asRecord(record.workingHours);
  return { timeZone: stringValue(record, "timeZone"), workingHours: { start: stringValue(hours, "start"), end: stringValue(hours, "end") } };
}

function validateInput(value: unknown): MeetingPlannerToolInput {
  const record = asRecord(value);
  if (!Array.isArray(record.participants)) throw new Error("INVALID_INPUT");
  return {
    date: stringValue(record, "date"),
    durationMinutes: integerValue(record, "durationMinutes"),
    participants: record.participants.map(participantValue),
    ...(record.limit === undefined ? {} : { limit: integerValue(record, "limit") }),
  };
}

const module: ToolModule = {
  run(rawInput, _context, signal): MeetingPlannerToolOutput {
    ensureNotAborted(signal);
    const input = validateInput(rawInput);
    return { windows: findMeetingWindows(input), date: input.date, durationMinutes: input.durationMinutes, policy: "15-minute grid; same calendar date; no holiday source" };
  },
};

export default module;
