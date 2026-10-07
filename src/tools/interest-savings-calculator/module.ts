import { createBusinessModule, currencyDecoration, optionalDecimal, requiredDecimal, requiredString } from "../business-module";
import type { InterestSavingsMode } from "../../engines/business-math";

const MODES = new Set<InterestSavingsMode>(["simple", "compound", "contribution", "goal"]);

const module = createBusinessModule(
  "interest-savings-calculator",
  (input) => {
    const mode = requiredString(input, "mode") as InterestSavingsMode;
    if (!MODES.has(mode)) throw new Error("INVALID_MODE");
    const compoundsPerYear = optionalDecimal(input, "compoundsPerYear");
    const periodicContribution = optionalDecimal(input, "periodicContribution");
    const target = optionalDecimal(input, "target");
    return {
      mode,
      principal: requiredDecimal(input, "principal"),
      annualRatePercent: requiredDecimal(input, "annualRatePercent"),
      years: requiredDecimal(input, "years"),
      ...(compoundsPerYear === undefined ? {} : { compoundsPerYear }),
      ...(periodicContribution === undefined ? {} : { periodicContribution }),
      ...(target === undefined ? {} : { target }),
    };
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
