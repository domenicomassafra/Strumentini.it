import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { icsViewerConfig } from "./date-time/configs";

export function IcsViewerTool() {
  return <DateTimeOperation config={icsViewerConfig} />;
}
