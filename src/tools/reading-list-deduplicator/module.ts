import { dedupeReadingList, parseCitationRecords, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { CitationRecord } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import type { ReadingListDeduplicatorOutput } from "./types";
import { recordInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal): ReadingListDeduplicatorOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const source = input.records ?? input.items ?? input.readingList;
    if (source === undefined) throw new Error("INVALID_INPUT");
    return { ...dedupeReadingList(parseCitationRecords(source) as CitationRecord[]), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
