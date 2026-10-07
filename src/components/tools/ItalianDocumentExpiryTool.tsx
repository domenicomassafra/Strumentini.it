import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { italianDocumentExpiryConfig } from "./date-time/configs";

export function ItalianDocumentExpiryTool() {
  return <DateTimeOperation config={italianDocumentExpiryConfig} />;
}
