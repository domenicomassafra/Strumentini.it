import { parseCitationRecords, RESEARCH_KNOWLEDGE_ENGINE_VERSION, sortReferenceList } from "../../engines/research-knowledge";
import type { CitationRecord } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import { modeInput, recordInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const source = input.records ?? input.citations ?? input.items;
    if (source === undefined) throw new Error("INVALID_INPUT");
    const order = modeInput(rawInput, ["order", "sortBy"], ["author", "year", "title"] as const, "author");
    return { ...sortReferenceList(parseCitationRecords(source) as CitationRecord[], order), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
