import { calculateRoas } from "../../engines/marketing-math";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const record = value as Record<string, unknown>;
    if (typeof record.spend !== "string" || typeof record.revenue !== "string") throw new Error("INVALID_INPUT");
    return calculateRoas(record.spend, record.revenue);
  },
};

export default module;
