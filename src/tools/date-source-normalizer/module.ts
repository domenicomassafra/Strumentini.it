import { normalizeDateSource, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import type { DateSourceNormalizerOutput } from "./types";
import { booleanInput, stringInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal): DateSourceNormalizerOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const dayFirst = booleanInput(rawInput, ["dayFirst", "day-first"], false);
    return { ...normalizeDateSource(stringInput(rawInput, ["value", "date", "input"]), { dayFirst }), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
