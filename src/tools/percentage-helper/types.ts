import type { PercentageInput as EngineInput, PercentageResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type PercentageHelperInput = EngineInput;

export interface PercentageHelperOutput extends PercentageResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
