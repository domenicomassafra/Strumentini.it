import { BusinessMathTool } from "./BusinessMathTool";
import { latePaymentInterestConfig } from "./configs";

export function LatePaymentInterestTool() {
  return <BusinessMathTool config={latePaymentInterestConfig} />;
}
