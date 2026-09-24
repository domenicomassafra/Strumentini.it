import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { weekNumberConfig } from "./date-time/configs";

export function WeekNumberConverterTool() {
  return <DateTimeOperation config={weekNumberConfig} />;
}
