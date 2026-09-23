import { findTimezoneOverlap, type WorkingHours } from "../../engines/client-time-math";
import type { ToolModule } from "../../runtime/types";
import type { TimezoneOverlapInput, TimezoneOverlapOutput } from "./types";

function isWorkingHours(value: unknown): value is WorkingHours {
  return typeof value === "object" && value !== null &&
    typeof (value as Record<string, unknown>).start === "string" &&
    typeof (value as Record<string, unknown>).end === "string";
}

function validateInput(value: unknown): TimezoneOverlapInput {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const input = value as Partial<TimezoneOverlapInput>;
  if (typeof input.date !== "string" || typeof input.otherTimeZone !== "string" || !isWorkingHours(input.otherWorkingHours)) {
    throw new Error("INVALID_INPUT");
  }
  return input as TimezoneOverlapInput;
}

const module: ToolModule = {
  run(rawInput, context, signal): TimezoneOverlapOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = validateInput(rawInput);
    const homeTimeZone = context.defaults.timezone;
    const homeWorkingHours = context.defaults.workingHours;
    if (typeof homeTimeZone?.value !== "string") throw new Error("INVALID_TIMEZONE");
    if (!isWorkingHours(homeWorkingHours?.value)) throw new Error("INVALID_WORKING_HOURS");
    return {
      ...findTimezoneOverlap({
        date: input.date,
        homeTimeZone: homeTimeZone.value,
        otherTimeZone: input.otherTimeZone,
        homeWorkingHours: homeWorkingHours.value,
        otherWorkingHours: input.otherWorkingHours,
      }),
      homeTimeZone: homeTimeZone.value,
      otherTimeZone: input.otherTimeZone,
      homeWorkingHours: homeWorkingHours.value,
      provenance: {
        homeTimeZone: homeTimeZone.provenance,
        homeWorkingHours: homeWorkingHours.provenance,
      },
    };
  },
};

export default module;
