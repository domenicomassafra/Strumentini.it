import { dedupeNotes, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import type { NotesDeduplicatorOutput } from "./types";
import { recordInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal): NotesDeduplicatorOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const source = input.notes ?? input.items ?? input.text;
    if (source === undefined) throw new Error("INVALID_INPUT");
    return { ...dedupeNotes(source), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
