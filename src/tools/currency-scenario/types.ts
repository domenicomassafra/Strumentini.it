import type { CurrencyScenarioInput as EngineInput, CurrencyScenarioResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type CurrencyScenarioInput = EngineInput;

export interface CurrencyScenarioOutput extends CurrencyScenarioResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
