import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { ageConfig } from "./date-time/configs";

export function AgeDateAnniversaryTool() {
  return <DateTimeOperation config={ageConfig} />;
}
