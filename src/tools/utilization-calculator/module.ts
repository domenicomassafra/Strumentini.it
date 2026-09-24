import { createBusinessModule, inputRecord, requiredDecimal } from "../business-module";
import type { UtilizationCalculatorInput } from "./types";

const module = createBusinessModule(
  "utilization",
  (raw) => {
    const input = inputRecord(raw);
    return {
      availableHours: requiredDecimal(input, "availableHours"),
      billableHours: requiredDecimal(input, "billableHours"),
    } as UtilizationCalculatorInput;
  },
);

export default module;
