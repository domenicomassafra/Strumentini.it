import type { RetainerCapacityInput as EngineInput, RetainerCapacityResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type RetainerCapacityInput = EngineInput;

export interface RetainerCapacityOutput extends RetainerCapacityResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
