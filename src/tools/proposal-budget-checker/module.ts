import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { ProposalBudgetInput } from "./types";

const module = createBusinessModule(
  "proposal-budget",
  (raw) => {
    const input = inputRecord(raw);
    const directCosts = optionalDecimal(input, "directCosts");
    const contingency = optionalDecimal(input, "contingencyPercent");
    const targetMargin = optionalDecimal(input, "targetMarginPercent");
    return {
      quotedPrice: requiredDecimal(input, "quotedPrice"),
      estimatedHours: requiredDecimal(input, "estimatedHours"),
      hourlyRate: requiredDecimal(input, "hourlyRate"),
      ...(directCosts === undefined ? {} : { directCosts }),
      ...(contingency === undefined ? {} : { contingencyPercent: contingency }),
      ...(targetMargin === undefined ? {} : { targetMarginPercent: targetMargin }),
    } as ProposalBudgetInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
