import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { BreakEvenInput } from "./types";

const module = createBusinessModule(
  "break-even",
  (raw) => {
    const input = inputRecord(raw);
    const units = optionalDecimal(input, "units");
    return {
      fixedCosts: requiredDecimal(input, "fixedCosts"),
      unitPrice: requiredDecimal(input, "unitPrice"),
      unitVariableCost: requiredDecimal(input, "unitVariableCost"),
      ...(units === undefined ? {} : { units }),
    } as BreakEvenInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
