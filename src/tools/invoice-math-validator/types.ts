import type { InvoiceMathInput as EngineInput, InvoiceMathResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type InvoiceMathValidatorInput = EngineInput;

export interface InvoiceMathValidatorOutput extends InvoiceMathResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
