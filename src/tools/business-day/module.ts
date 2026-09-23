import {
  addBusinessDays,
  businessDaysBetween,
  type DayCode,
} from "../../engines/date-time/business-days";
import type { ToolModule } from "../../runtime/types";
import type { BusinessDayInput, BusinessDayOutput } from "./types";

function asWorkweek(value: unknown): readonly DayCode[] | undefined {
  return Array.isArray(value) ? (value as DayCode[]) : undefined;
}

function validateInput(value: unknown): BusinessDayInput {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const candidate = value as Partial<BusinessDayInput> & Record<string, unknown>;
  if (candidate.mode !== "add" && candidate.mode !== "between") throw new Error("INVALID_INPUT");
  if (typeof candidate.startDate !== "string") throw new Error("INVALID_INPUT");
  if (candidate.mode === "add" && typeof candidate.amount !== "number") throw new Error("INVALID_INPUT");
  if (candidate.mode === "between" && typeof candidate.endDate !== "string") throw new Error("INVALID_INPUT");
  if (candidate.excludedDates !== undefined && !Array.isArray(candidate.excludedDates)) {
    throw new Error("INVALID_INPUT");
  }
  return candidate as BusinessDayInput;
}

const module: ToolModule = {
  run(rawInput, context, signal): BusinessDayOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = validateInput(rawInput);
    const workweek = input.workweek ?? asWorkweek(context.defaults.workweek?.value);
    if (workweek === undefined) throw new Error("INVALID_WORKWEEK");
    const excludedDates = input.excludedDates ?? [];
    const assumptions = {
      workweek,
      excludedDates,
      inclusiveStart: false,
      inclusiveEnd: true,
    } as const;

    if (input.mode === "add") {
      return {
        mode: "add",
        resultDate: addBusinessDays(input.startDate, input.amount, assumptions),
        amount: input.amount,
        assumptions,
      };
    }

    return {
      mode: "between",
      businessDays: businessDaysBetween(input.startDate, input.endDate, assumptions),
      assumptions,
    };
  },
};

export default module;
