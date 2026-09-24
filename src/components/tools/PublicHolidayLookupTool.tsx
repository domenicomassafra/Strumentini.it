import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { holidayConfig } from "./date-time/configs";

export function PublicHolidayLookupTool() {
  return <DateTimeOperation config={holidayConfig} />;
}
