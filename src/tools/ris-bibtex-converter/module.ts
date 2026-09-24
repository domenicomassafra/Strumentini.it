import { convertBibtexToRis, convertRisToBibtex, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import { modeInput, stringInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const text = stringInput(rawInput, ["text", "input", "records"]);
    const direction = modeInput(rawInput, ["direction", "mode"], ["ris-to-bibtex", "bibtex-to-ris"] as const, "ris-to-bibtex");
    const result = direction === "ris-to-bibtex" ? convertRisToBibtex(text) : convertBibtexToRis(text);
    return { direction, ...result, engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
