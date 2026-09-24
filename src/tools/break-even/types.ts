import type { BreakEvenInput as EngineInput, BreakEvenResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type BreakEvenInput = EngineInput;

export interface BreakEvenOutput extends BreakEvenResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
