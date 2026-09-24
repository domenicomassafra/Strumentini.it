import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { icsBuilderConfig } from "./date-time/configs";

export function IcsEventBuilderTool() {
  return <DateTimeOperation config={icsBuilderConfig} />;
}
