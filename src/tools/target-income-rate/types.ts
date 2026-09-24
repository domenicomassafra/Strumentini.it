import type { TargetIncomeRateInput as EngineInput, TargetIncomeRateResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type TargetIncomeRateInput = EngineInput;

export interface TargetIncomeRateOutput extends TargetIncomeRateResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
