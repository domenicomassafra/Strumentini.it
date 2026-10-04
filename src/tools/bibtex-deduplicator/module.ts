import { dedupeBibtexEntries, parseBibtexDocument, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import type { BibtexDeduplicatorOutput } from "./types";
import { stringInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal): BibtexDeduplicatorOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const document = parseBibtexDocument(stringInput(rawInput, ["text", "bibtex", "input"]));
    return {
      ...dedupeBibtexEntries(document.entries),
      directiveCount: document.directives.length,
      truncated: document.truncated,
      engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION,
    };
  },
};

export default module;
