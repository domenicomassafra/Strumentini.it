import type { LatePaymentInput as EngineInput, LatePaymentResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type LatePaymentInput = EngineInput;

export interface LatePaymentOutput extends LatePaymentResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
