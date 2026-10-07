import { BusinessMathTool } from "./BusinessMathTool";
import { engineeringUnitConverterConfig } from "./configs";

export function EngineeringUnitConverterTool() {
  return <BusinessMathTool config={engineeringUnitConverterConfig} />;
}
