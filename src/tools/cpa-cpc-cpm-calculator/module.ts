import { calculatePerformanceMetric } from "../../engines/marketing-math";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const record = value as Record<string, unknown>;
    const metric = record.metric;
    if (typeof metric !== "string" || typeof record.spend !== "string") throw new Error("INVALID_INPUT");
    const denominator = record.denominator ?? (metric === "cpa" ? record.conversions : metric === "cpc" ? record.clicks : record.impressions);
    if (typeof denominator !== "string") throw new Error("INVALID_INPUT");
    return calculatePerformanceMetric(metric, record.spend, denominator);
  },
};

export default module;
