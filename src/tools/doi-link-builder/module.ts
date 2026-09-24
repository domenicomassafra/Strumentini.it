import { buildDoiLink, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import { stringInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    return { ...buildDoiLink(stringInput(rawInput, ["value", "doi", "input"])), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
