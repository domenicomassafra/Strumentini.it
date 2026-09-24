import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { LatePaymentInput } from "./types";

const module = createBusinessModule(
  "late-payment-interest",
  (raw) => {
    const input = inputRecord(raw);
    const annualRatePercent = optionalDecimal(input, "annualRatePercent");
    const annualRate = optionalDecimal(input, "annualRate");
    const basisValue = input.dayCountBasis;
    const basis = basisValue === undefined ? undefined : Number(basisValue);
    if (basis !== undefined && basis !== 360 && basis !== 365) throw new Error("INVALID_DAY_COUNT_BASIS");
    return {
      principal: requiredDecimal(input, "principal"),
      daysLate: requiredDecimal(input, "daysLate"),
      ...(annualRatePercent === undefined ? {} : { annualRatePercent }),
      ...(annualRate === undefined ? {} : { annualRate }),
      ...(basis === undefined ? {} : { dayCountBasis: basis }),
    } as LatePaymentInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
