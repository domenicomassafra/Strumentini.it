import type { ToolModule } from "../../runtime/types";
import { calculateTfr15, type TfrAnnualInput15 } from "../../engines/italy/tfr-15";

const module: ToolModule = {
  run(raw, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof raw !== "object" || raw === null || !("rows" in raw) || !Array.isArray(raw.rows)) {
      throw new Error("TFR_INPUT: rows required");
    }
    const candidate = raw as { rows: TfrAnnualInput15[]; contributionReductionPercent?: number };
    return calculateTfr15(candidate.rows, candidate.contributionReductionPercent);
  },
};

export default module;
