import { citationKeysFor, parseCitationRecords, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import type { CitationKeyGeneratorOutput } from "./types";
import { recordInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal): CitationKeyGeneratorOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const source = input.records ?? input.citations ?? input.items ?? input.record;
    if (source === undefined) throw new Error("INVALID_INPUT");
    const records = parseCitationRecords(source);
    const { keys, collisions } = citationKeysFor(records);
    return { keys, records, keyCount: keys.length, collisions, engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
