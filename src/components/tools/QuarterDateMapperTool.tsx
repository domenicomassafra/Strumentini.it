import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { quarterConfig } from "./date-time/configs";

export function QuarterDateMapperTool() {
  return <DateTimeOperation config={quarterConfig} />;
}
