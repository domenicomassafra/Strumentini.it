import { cleanResearchUrl, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import { stringInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    return { ...cleanResearchUrl(stringInput(rawInput, ["url", "value", "input"])), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
