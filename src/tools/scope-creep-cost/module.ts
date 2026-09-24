import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { ScopeCreepCostInput } from "./types";

const module = createBusinessModule(
  "scope-creep-cost",
  (raw) => {
    const input = inputRecord(raw);
    const originalHours = optionalDecimal(input, "originalHours");
    const originalBudget = optionalDecimal(input, "originalBudget");
    return {
      hourlyRate: requiredDecimal(input, "hourlyRate"),
      additionalHours: requiredDecimal(input, "additionalHours"),
      ...(originalHours === undefined ? {} : { originalHours }),
      ...(originalBudget === undefined ? {} : { originalBudget }),
    } as ScopeCreepCostInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
