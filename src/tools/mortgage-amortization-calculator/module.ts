import { createBusinessModule, currencyDecoration, optionalDecimal, requiredDecimal } from "../business-module";

const module = createBusinessModule(
  "mortgage-amortization-calculator",
  (input) => ({
    principal: requiredDecimal(input, "principal"),
    annualRatePercent: requiredDecimal(input, "annualRatePercent"),
    termMonths: requiredDecimal(input, "termMonths"),
    explicitFees: optionalDecimal(input, "explicitFees"),
  }),
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
