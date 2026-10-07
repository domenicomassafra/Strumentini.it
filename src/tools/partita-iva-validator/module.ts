import { normalizePartitaIva, RESEARCH_REFERENCE_ENGINE_VERSION } from "../../engines/research-reference";
import type { ToolModule } from "../../runtime/types";

function inputValue(rawInput: unknown): string {
  if (typeof rawInput !== "object" || rawInput === null) throw new Error("INVALID_INPUT");
  const input = rawInput as Record<string, unknown>;
  if (typeof input.value !== "string") throw new Error("INVALID_INPUT");
  return input.value;
}

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    return {
      ...normalizePartitaIva(inputValue(rawInput)),
      engineVersion: RESEARCH_REFERENCE_ENGINE_VERSION,
    };
  },
};

export default module;
