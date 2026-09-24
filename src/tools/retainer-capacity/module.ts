import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { RetainerCapacityInput } from "./types";

const module = createBusinessModule(
  "retainer-capacity",
  (raw) => {
    const input = inputRecord(raw);
    const retainerAmount = optionalDecimal(input, "retainerAmount");
    const monthlyCosts = optionalDecimal(input, "monthlyCosts");
    const targetMargin = optionalDecimal(input, "targetMarginPercent");
    return {
      capacityHours: requiredDecimal(input, "capacityHours"),
      deliveryHoursPerClient: requiredDecimal(input, "deliveryHoursPerClient"),
      ...(retainerAmount === undefined ? {} : { retainerAmount }),
      ...(monthlyCosts === undefined ? {} : { monthlyCosts }),
      ...(targetMargin === undefined ? {} : { targetMarginPercent: targetMargin }),
    } as RetainerCapacityInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
