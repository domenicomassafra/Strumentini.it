import { BusinessMathTool } from "./BusinessMathTool";
import { invoiceNumberGeneratorConfig } from "./configs";

export function InvoiceNumberGeneratorTool() {
  return <BusinessMathTool config={invoiceNumberGeneratorConfig} />;
}
