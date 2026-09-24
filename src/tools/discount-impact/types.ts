import type { DiscountImpactInput as EngineInput, DiscountImpactResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type DiscountImpactInput = EngineInput;

export interface DiscountImpactOutput extends DiscountImpactResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
