import { convertRate, type RateUnit } from "../../engines/client-time-math";
import type { ToolModule } from "../../runtime/types";
import type { RateConverterInput, RateConverterOutput } from "./types";

function isRateUnit(value: unknown): value is RateUnit {
  return value === "hour" || value === "day" || value === "project";
}

function validateInput(value: unknown): RateConverterInput {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const input = value as Partial<RateConverterInput>;
  if (typeof input.amount !== "string" || !isRateUnit(input.from) || !isRateUnit(input.to)) {
    throw new Error("INVALID_INPUT");
  }
  if (input.projectHours !== undefined && typeof input.projectHours !== "string") throw new Error("INVALID_INPUT");
  if ((input.from === "project" || input.to === "project") && input.projectHours === undefined) {
    throw new Error("INVALID_PROJECT_HOURS_REQUIRED");
  }
  return input as RateConverterInput;
}

const module: ToolModule = {
  run(rawInput, context, signal): RateConverterOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = validateInput(rawInput);
    const currency = context.defaults.currency;
    const hoursPerDay = context.defaults.hoursPerDay;
    if (typeof currency?.value !== "string" || typeof hoursPerDay?.value !== "string") throw new Error("INVALID_DEFAULTS");
    return {
      ...convertRate({ ...input, hoursPerDay: hoursPerDay.value }),
      currency: currency.value,
      provenance: {
        currency: currency.provenance,
        hoursPerDay: hoursPerDay.provenance,
      },
    };
  },
};

export default module;
