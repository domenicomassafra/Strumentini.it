import { createBusinessModule, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { CapacityPlannerInput } from "./types";

const module = createBusinessModule(
  "capacity-planner",
  (raw) => {
    const input = inputRecord(raw);
    const target = optionalDecimal(input, "targetUtilizationPercent");
    const reserved = optionalDecimal(input, "reservedHours");
    return {
      availableHours: requiredDecimal(input, "availableHours"),
      ...(target === undefined ? {} : { targetUtilizationPercent: target }),
      ...(reserved === undefined ? {} : { reservedHours: reserved }),
    } as CapacityPlannerInput;
  },
);

export default module;
