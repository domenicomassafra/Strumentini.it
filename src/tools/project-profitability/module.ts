import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { ProjectProfitabilityInput } from "./types";

const module = createBusinessModule(
  "project-profitability",
  (raw) => {
    const input = inputRecord(raw);
    const fixedCosts = optionalDecimal(input, "fixedCosts");
    const hourlyCost = optionalDecimal(input, "hourlyCost");
    return {
      revenue: requiredDecimal(input, "revenue"),
      hours: requiredDecimal(input, "hours"),
      ...(fixedCosts === undefined ? {} : { fixedCosts }),
      ...(hourlyCost === undefined ? {} : { hourlyCost }),
    } as ProjectProfitabilityInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
