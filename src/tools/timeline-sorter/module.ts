import { parseCitationRecords, RESEARCH_KNOWLEDGE_ENGINE_VERSION, sortTimeline } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import { modeInput, recordInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const source = input.records ?? input.items ?? input.events;
    if (source === undefined) throw new Error("INVALID_INPUT");
    const direction = modeInput(rawInput, ["direction", "order"], ["ascending", "descending"] as const, "ascending");
    return { ...sortTimeline(parseCitationRecords(source), direction), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
