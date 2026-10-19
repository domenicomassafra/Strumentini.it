import { createBusinessModule, currencyDecoration, inputRecord, optionalDecimal, optionalInputString } from "../business-module";
import type { PercentageHelperInput } from "./types";

const MODES = new Set([
  "add",
  "reverse",
  "of",
  "what-percent",
  "increase",
  "decrease",
  "variation",
  "reverse-discount",
  "reverse-cascade",
  "cascade",
]);

function discountRates(input: Record<string, unknown>): readonly string[] | undefined {
  const raw = input.rates;
  if (Array.isArray(raw)) {
    const values = raw.map((value) => typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "");
    if (values.some((value) => value === "")) throw new Error("INVALID_RATE");
    return values;
  }
  const text = optionalInputString(input, "rates");
  if (text === undefined) return undefined;
  const values = text.split(";").map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) throw new Error("INVALID_RATE");
  return values;
}

const module = createBusinessModule(
  "percentage-helper",
  (raw) => {
    const input = inputRecord(raw);
    const base = optionalDecimal(input, "base");
    const amount = optionalDecimal(input, "amount");
    const ratePercent = optionalDecimal(input, "ratePercent") ?? optionalDecimal(input, "percent");
    const mode = input.mode;
    if (mode !== undefined && (typeof mode !== "string" || !MODES.has(mode))) throw new Error("INVALID_MODE");
    if (ratePercent === undefined && mode !== "what-percent" && mode !== "variation" && mode !== "cascade" && mode !== "reverse-cascade") throw new Error("INVALID_INPUT");
    const rates = discountRates(input);
    return {
      ...(base === undefined ? {} : { base }),
      ...(amount === undefined ? {} : { amount }),
      ...(ratePercent === undefined ? {} : { ratePercent }),
      ...(rates === undefined ? {} : { rates }),
      ...(mode === undefined ? {} : { mode }),
    } as PercentageHelperInput;
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
