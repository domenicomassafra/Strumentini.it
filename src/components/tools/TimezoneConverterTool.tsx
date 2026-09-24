import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { timezoneConverterConfig } from "./date-time/configs";

export function TimezoneConverterTool() {
  return <DateTimeOperation config={timezoneConverterConfig} />;
}
