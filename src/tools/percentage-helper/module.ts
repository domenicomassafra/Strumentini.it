import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal } from "../business-module";
import type { PercentageHelperInput } from "./types";

const module = createBusinessModule(
  "percentage-helper",
  (raw) => {
    const input = inputRecord(raw);
    const base = optionalDecimal(input, "base");
    const amount = optionalDecimal(input, "amount");
    const ratePercent = optionalDecimal(input, "ratePercent") ?? optionalDecimal(input, "percent");
    const mode = input.mode;
    if (ratePercent === undefined) throw new Error("INVALID_INPUT");
    if (mode !== undefined && mode !== "add" && mode !== "reverse") throw new Error("INVALID_MODE");
    return {
      ...(base === undefined ? {} : { base }),
      ...(amount === undefined ? {} : { amount }),
      ratePercent,
      ...(mode === undefined ? {} : { mode }),
    } as PercentageHelperInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
