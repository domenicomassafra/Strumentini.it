import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { PaymentFeeInput } from "./types";

const module = createBusinessModule(
  "payment-fee-gross-up",
  (raw) => {
    const input = inputRecord(raw);
    const feeRate = optionalDecimal(input, "feeRate");
    const feePercent = optionalDecimal(input, "feePercent");
    return {
      targetNet: requiredDecimal(input, "targetNet"),
      ...(feeRate === undefined ? {} : { feeRate }),
      ...(feePercent === undefined ? {} : { feePercent }),
    } as PaymentFeeInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
