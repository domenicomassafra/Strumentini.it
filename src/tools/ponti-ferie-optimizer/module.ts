import { optimizeItalianBridges, type DayCode } from "../../engines/italy";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof rawInput !== "object" || rawInput === null) throw new Error("INVALID_INPUT");
    const input = rawInput as Record<string, unknown>;
    if (!Array.isArray(input.workweek) || !input.workweek.every((value) => typeof value === "string")) throw new Error("INVALID_WORKWEEK");
    return optimizeItalianBridges({
      year: Number(input.year),
      leaveDayBudget: Number(input.leaveDayBudget),
      workweek: input.workweek as DayCode[],
      maxResults: input.maxResults === undefined ? 20 : Number(input.maxResults),
    });
  },
};

export default module;
