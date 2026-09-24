import { BusinessMathTool } from "./BusinessMathTool";
import { effectiveHourlyRateConfig } from "./configs";

export function EffectiveHourlyRateTool() {
  return <BusinessMathTool config={effectiveHourlyRateConfig} />;
}
