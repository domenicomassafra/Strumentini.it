import { analyzeVocabulary, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import { numberInput, recordInput, stringInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const text = stringInput(rawInput, ["text", "input", "value"]);
    const minLength = numberInput(rawInput, ["minLength", "min-length"], 1);
    const limit = numberInput(rawInput, ["limit", "maxTerms"], 50);
    const stopwords = recordInput(rawInput).stopwords;
    if (stopwords !== undefined && !Array.isArray(stopwords)) throw new Error("INVALID_INPUT");
    const stopwordValues = Array.isArray(stopwords)
      ? stopwords.filter((word: unknown): word is string => typeof word === "string")
      : undefined;
    return { ...analyzeVocabulary(text, { minLength, limit, ...(stopwordValues === undefined ? {} : { stopwords: stopwordValues }) }), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
