import { RESEARCH_KNOWLEDGE_ENGINE_VERSION, validateIsbnForResearch } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import { stringInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    return { ...validateIsbnForResearch(stringInput(rawInput, ["value", "isbn", "input"])), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
