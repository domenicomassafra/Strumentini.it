import { BusinessMathTool } from "./BusinessMathTool";
import { interestSavingsCalculatorConfig } from "./configs";

export function InterestSavingsCalculatorTool() {
  return <BusinessMathTool config={interestSavingsCalculatorConfig} />;
}
