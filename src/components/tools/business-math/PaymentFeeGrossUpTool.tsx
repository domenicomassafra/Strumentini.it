import { BusinessMathTool } from "./BusinessMathTool";
import { paymentFeeGrossUpConfig } from "./configs";

export function PaymentFeeGrossUpTool() {
  return <BusinessMathTool config={paymentFeeGrossUpConfig} />;
}
