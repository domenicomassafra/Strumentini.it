import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { DiscountImpactInput } from "./types";

const module = createBusinessModule(
  "discount-impact",
  (raw) => {
    const input = inputRecord(raw);
    const discountPercent = optionalDecimal(input, "discountPercent");
    const discountRate = optionalDecimal(input, "discountRate");
    const units = optionalDecimal(input, "units");
    return {
      originalPrice: requiredDecimal(input, "originalPrice"),
      ...(discountPercent === undefined ? {} : { discountPercent }),
      ...(discountRate === undefined ? {} : { discountRate }),
      ...(units === undefined ? {} : { units }),
    } as DiscountImpactInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
