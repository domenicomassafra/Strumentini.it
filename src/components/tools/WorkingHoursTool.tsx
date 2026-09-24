import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { workingHoursConfig } from "./date-time/configs";

export function WorkingHoursTool() {
  return <DateTimeOperation config={workingHoursConfig} />;
}
