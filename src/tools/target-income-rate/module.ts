import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal, resolvedValue } from "../business-module";
import type { TargetIncomeRateInput } from "./types";

const module = createBusinessModule(
  "target-income-rate",
  (raw, context) => {
    const input = inputRecord(raw);
    const nonBillableHours = optionalDecimal(input, "nonBillableHours");
    const expenses = optionalDecimal(input, "expenses");
    const profileHours = resolvedValue(context, "hoursPerDay");
    const hoursPerDay = optionalDecimal(input, "hoursPerDay")
      ?? (typeof profileHours === "string" || typeof profileHours === "number" ? String(profileHours) : undefined);
    return {
      targetIncome: requiredDecimal(input, "targetIncome"),
      billableHours: requiredDecimal(input, "billableHours"),
      ...(nonBillableHours === undefined ? {} : { nonBillableHours }),
      ...(expenses === undefined ? {} : { expenses }),
      ...(hoursPerDay === undefined ? {} : { hoursPerDay }),
    } as TargetIncomeRateInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
