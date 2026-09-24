import { generateCitationKey, parseCitationRecords, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { CitationRecord } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import { recordInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const source = input.records ?? input.citations ?? input.items ?? input.record;
    if (source === undefined) throw new Error("INVALID_INPUT");
    const records = parseCitationRecords(source);
    const usedKeys: string[] = [];
    const keys = records.map((record) => {
      const key = generateCitationKey(record as CitationRecord, usedKeys);
      usedKeys.push(key);
      return key;
    });
    return { keys, records, engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
