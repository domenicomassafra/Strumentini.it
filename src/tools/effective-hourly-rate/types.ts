import type { EffectiveHourlyRateInput as EngineInput, EffectiveHourlyRateResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type EffectiveHourlyRateInput = EngineInput;

export interface EffectiveHourlyRateOutput extends EffectiveHourlyRateResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
