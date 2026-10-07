import { calculateGestioneSeparataContribution } from "../../engines/italy";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof rawInput !== "object" || rawInput === null) throw new Error("INVALID_INPUT");
    const input = rawInput as Record<string, unknown>;
    return calculateGestioneSeparataContribution({
      year: Number(input.year),
      profile: String(input.profile ?? ""),
      incomeEur: Number(input.incomeEur),
    });
  },
};

export default module;
