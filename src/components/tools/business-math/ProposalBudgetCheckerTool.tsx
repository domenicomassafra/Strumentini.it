import { BusinessMathTool } from "./BusinessMathTool";
import { proposalBudgetCheckerConfig } from "./configs";

export function ProposalBudgetCheckerTool() {
  return <BusinessMathTool config={proposalBudgetCheckerConfig} />;
}
