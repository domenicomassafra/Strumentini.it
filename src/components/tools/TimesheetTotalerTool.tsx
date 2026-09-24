import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { timesheetConfig } from "./date-time/configs";

export function TimesheetTotalerTool() {
  return <DateTimeOperation config={timesheetConfig} />;
}
