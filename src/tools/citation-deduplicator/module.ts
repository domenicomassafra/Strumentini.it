import { dedupeCitationRecords, parseCitationRecords, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import type { CitationDeduplicatorOutput } from "./types";
import { recordInput } from "../research-knowledge";

const MODES = ["exact", "identifier", "title-author-year"] as const;

const module: ToolModule = {
  run(rawInput, _context, signal): CitationDeduplicatorOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const records = input.records ?? input.citations ?? input.items;
    if (records === undefined) throw new Error("INVALID_INPUT");
    const mode = input.mode ?? "identifier";
    if (typeof mode !== "string" || !MODES.includes(mode as (typeof MODES)[number])) throw new Error("INVALID_INPUT");
    return { ...dedupeCitationRecords(parseCitationRecords(records), { mode: mode as (typeof MODES)[number] }), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
