import { countSourceDomains, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import type { DomainFrequencyCounterOutput } from "./types";
import { arrayInput, recordInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal): DomainFrequencyCounterOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const raw = input.urls ?? input.sources ?? input.text;
    const values = typeof raw === "string" ? raw.split(/\n/u).map((value) => value.trim()).filter(Boolean) : arrayInput({ urls: raw }, ["urls"]);
    return { ...countSourceDomains(values.filter((value): value is string => typeof value === "string")), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
