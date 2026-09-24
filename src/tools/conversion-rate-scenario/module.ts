import { calculateConversionScenario } from "../../engines/marketing-math";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const record = value as Record<string, unknown>;
    const target = record.targetRatePercent ?? record.targetRate;
    if (typeof record.visits !== "string" || typeof record.conversions !== "string" || typeof target !== "string") throw new Error("INVALID_INPUT");
    return calculateConversionScenario(record.visits, record.conversions, target);
  },
};

export default module;
