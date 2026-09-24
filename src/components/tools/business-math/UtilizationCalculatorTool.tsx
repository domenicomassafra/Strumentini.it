import { BusinessMathTool } from "./BusinessMathTool";
import { utilizationCalculatorConfig } from "./configs";

export function UtilizationCalculatorTool() {
  return <BusinessMathTool config={utilizationCalculatorConfig} />;
}
