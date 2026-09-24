import type { ScopeCreepCostInput as EngineInput, ScopeCreepCostResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type ScopeCreepCostInput = EngineInput;

export interface ScopeCreepCostOutput extends ScopeCreepCostResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
