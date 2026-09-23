import {
  normalizeDoi,
  normalizeIsbn,
  RESEARCH_REFERENCE_ENGINE_VERSION,
} from "../../engines/research-reference";
import type { ToolModule } from "../../runtime/types";
import type { DoiIsbnInput, DoiIsbnOutput } from "./types";

function validateInput(value: unknown): DoiIsbnInput {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const candidate = value as Partial<DoiIsbnInput> & Record<string, unknown>;
  if ((candidate.kind !== "doi" && candidate.kind !== "isbn") || typeof candidate.value !== "string") {
    throw new Error("INVALID_INPUT");
  }
  return candidate as DoiIsbnInput;
}

const module: ToolModule = {
  run(rawInput, _context, signal): DoiIsbnOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = validateInput(rawInput);
    const result = input.kind === "doi" ? normalizeDoi(input.value) : normalizeIsbn(input.value);
    return { ...result, engineVersion: RESEARCH_REFERENCE_ENGINE_VERSION };
  },
};

export default module;
