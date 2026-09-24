import { DateTimeOperation } from "./date-time/DateTimeOperation";
import { addSubtractDaysConfig } from "./date-time/configs";

export function AddSubtractDaysTool() {
  return <DateTimeOperation config={addSubtractDaysConfig} />;
}
