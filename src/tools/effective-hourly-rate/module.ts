import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { EffectiveHourlyRateInput } from "./types";

const module = createBusinessModule(
  "effective-hourly-rate",
  (raw) => {
    const input = inputRecord(raw);
    const costs = optionalDecimal(input, "costs");
    return {
      revenue: requiredDecimal(input, "revenue"),
      hours: requiredDecimal(input, "hours"),
      ...(costs === undefined ? {} : { costs }),
    } as EffectiveHourlyRateInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
