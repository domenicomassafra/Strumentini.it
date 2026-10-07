import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { timezoneConverterConfig } from "./date-time/configs";
import { LiveTimeSurface } from "./date-time/LiveTimeSurface";

export function TimezoneConverterTool() {
  return <><DateTimeOperation config={timezoneConverterConfig} /><LiveTimeSurface mode="world-clock" /></>;
}
