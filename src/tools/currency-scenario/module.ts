import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, requiredDecimal } from "../business-module";
import type { CurrencyScenarioInput } from "./types";

const module = createBusinessModule(
  "currency-scenario",
  (raw) => {
    const input = inputRecord(raw);
    const rate = optionalDecimal(input, "rate");
    const fromRate = optionalDecimal(input, "fromRate");
    const toRate = optionalDecimal(input, "toRate");
    const fromCurrency = input.fromCurrency;
    const toCurrency = input.toCurrency;
    if (fromCurrency !== undefined && typeof fromCurrency !== "string") throw new Error("INVALID_INPUT");
    if (toCurrency !== undefined && typeof toCurrency !== "string") throw new Error("INVALID_INPUT");
    return {
      amount: requiredDecimal(input, "amount"),
      ...(rate === undefined ? {} : { rate }),
      ...(fromRate === undefined ? {} : { fromRate }),
      ...(toRate === undefined ? {} : { toRate }),
      ...(fromCurrency === undefined ? {} : { fromCurrency }),
      ...(toCurrency === undefined ? {} : { toCurrency }),
    } as CurrencyScenarioInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
