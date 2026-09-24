import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { deadlineConfig } from "./date-time/configs";

export function DeadlineCountdownTool() {
  return <DateTimeOperation config={deadlineConfig} />;
}
