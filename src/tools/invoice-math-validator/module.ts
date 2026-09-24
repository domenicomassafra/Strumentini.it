import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal } from "../business-module";
import type { InvoiceMathValidatorInput } from "./types";

const module = createBusinessModule(
  "invoice-math",
  (raw) => {
    const input = inputRecord(raw);
    const subtotal = optionalDecimal(input, "subtotal");
    const taxRate = optionalDecimal(input, "taxRatePercent");
    const discount = optionalDecimal(input, "discountPercent");
    const total = optionalDecimal(input, "total");
    const lineItems = input.lineItems;
    if (lineItems !== undefined && !Array.isArray(lineItems)) throw new Error("INVALID_LINE_ITEMS");
    return {
      ...(lineItems === undefined ? {} : { lineItems }),
      ...(subtotal === undefined ? {} : { subtotal }),
      ...(taxRate === undefined ? {} : { taxRatePercent: taxRate }),
      ...(discount === undefined ? {} : { discountPercent: discount }),
      ...(total === undefined ? {} : { total }),
    } as InvoiceMathValidatorInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
