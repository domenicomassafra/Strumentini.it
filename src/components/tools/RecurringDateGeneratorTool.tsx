import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { recurrenceConfig } from "./date-time/configs";

export function RecurringDateGeneratorTool() {
  return <DateTimeOperation config={recurrenceConfig} />;
}
