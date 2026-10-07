import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { deadlineConfig } from "./date-time/configs";
import { LiveTimeSurface } from "./date-time/LiveTimeSurface";
import { ResilientClockSurface } from "./date-time/ResilientClockSurface";

export function DeadlineCountdownTool() {
  return <><DateTimeOperation config={deadlineConfig} /><LiveTimeSurface mode="deadline" /><ResilientClockSurface /></>;
}
