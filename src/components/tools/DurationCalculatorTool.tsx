import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { durationConfig } from "./date-time/configs";

export function DurationCalculatorTool() {
  return <DateTimeOperation config={durationConfig} />;
}
