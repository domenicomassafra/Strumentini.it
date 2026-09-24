import type { ProposalBudgetInput as EngineInput, ProposalBudgetResult } from "../../engines/business-math";
import type { DefaultProvenance } from "../../runtime/types";

export type ProposalBudgetInput = EngineInput;

export interface ProposalBudgetOutput extends ProposalBudgetResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
