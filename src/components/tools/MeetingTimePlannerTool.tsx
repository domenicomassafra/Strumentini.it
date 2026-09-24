import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { meetingPlannerConfig } from "./date-time/configs";

export function MeetingTimePlannerTool() {
  return <DateTimeOperation config={meetingPlannerConfig} />;
}
