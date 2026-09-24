import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { epochConfig } from "./date-time/configs";

export function EpochBatchConverterTool() {
  return <DateTimeOperation config={epochConfig} />;
}
