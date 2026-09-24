import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { calendarListConfig } from "./date-time/configs";

export function CalendarDateListGeneratorTool() {
  return <DateTimeOperation config={calendarListConfig} />;
}
