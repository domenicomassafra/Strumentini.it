import { BusinessMathTool } from "./BusinessMathTool";
import { scientificCalculatorConfig } from "./configs";

export function ScientificCalculatorTool() {
  return <BusinessMathTool config={scientificCalculatorConfig} />;
}
