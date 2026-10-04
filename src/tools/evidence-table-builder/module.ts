import { buildEvidenceTable, parseCitationRecords, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import type { EvidenceTableBuilderOutput } from "./types";
import { recordInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal): EvidenceTableBuilderOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const source = input.records ?? input.evidence ?? input.items;
    if (source === undefined) throw new Error("INVALID_INPUT");
    return { ...buildEvidenceTable(parseCitationRecords(source)), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
