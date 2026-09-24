import type { ProjectProfitabilityInput as EngineInput, ProjectProfitabilityResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type ProjectProfitabilityInput = EngineInput;

export interface ProjectProfitabilityOutput extends ProjectProfitabilityResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
