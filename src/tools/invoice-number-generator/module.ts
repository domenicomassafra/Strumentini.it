import { createBusinessModule, inputRecord, optionalDecimal, requiredDecimal, requiredString } from "../business-module";
import type { InvoiceNumberGeneratorInput } from "./types";

const module = createBusinessModule(
  "invoice-number",
  (raw) => {
    const input = inputRecord(raw);
    const padding = optionalDecimal(input, "padding");
    const separator = optionalDecimal(input, "separator");
    return {
      prefix: requiredString(input, "prefix"),
      sequence: requiredDecimal(input, "sequence"),
      year: requiredDecimal(input, "year"),
      ...(padding === undefined ? {} : { padding: Number(padding) }),
      ...(separator === undefined ? {} : { separator }),
    } as InvoiceNumberGeneratorInput;
  },
);

export default module;
