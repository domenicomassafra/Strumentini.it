import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { decimalHoursConfig } from "./date-time/configs";

export function DecimalHoursConverterTool() {
  return <DateTimeOperation config={decimalHoursConfig} />;
}
