import { BusinessMathTool } from "./BusinessMathTool";
import { mortgageAmortizationCalculatorConfig } from "./configs";

export function MortgageAmortizationCalculatorTool() {
  return <BusinessMathTool config={mortgageAmortizationCalculatorConfig} />;
}
