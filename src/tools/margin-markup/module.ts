import { calculateMarginMarkup } from "../../engines/client-time-math";
import type { ToolModule } from "../../runtime/types";
import type { MarginMarkupInput, MarginMarkupOutput } from "./types";

function validateInput(value: unknown): MarginMarkupInput {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const input = value as Partial<MarginMarkupInput>;
  if (typeof input.price !== "string" || typeof input.cost !== "string") throw new Error("INVALID_INPUT");
  return input as MarginMarkupInput;
}

const module: ToolModule = {
  run(rawInput, context, signal): MarginMarkupOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = validateInput(rawInput);
    const currency = context.defaults.currency;
    if (typeof currency?.value !== "string") throw new Error("INVALID_DEFAULTS");
    return {
      ...calculateMarginMarkup(input.price, input.cost),
      currency: currency.value,
      currencyProvenance: currency.provenance,
    };
  },
};

export default module;
