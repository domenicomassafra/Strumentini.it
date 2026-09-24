import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { dateDifferenceConfig } from "./date-time/configs";

export function DateDifferenceTool() {
  return <DateTimeOperation config={dateDifferenceConfig} />;
}
