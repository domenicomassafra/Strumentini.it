import type { PaymentFeeInput as EngineInput, PaymentFeeResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type PaymentFeeInput = EngineInput;

export interface PaymentFeeOutput extends PaymentFeeResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
