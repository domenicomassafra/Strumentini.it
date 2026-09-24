import { BusinessMathTool } from "./BusinessMathTool";
import { invoiceMathValidatorConfig } from "./configs";

export function InvoiceMathValidatorTool() {
  return <BusinessMathTool config={invoiceMathValidatorConfig} />;
}
