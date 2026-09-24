import { createResearchPackManifest, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import { recordInput, stringInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const rawTools = input.tools ?? input.ids;
    const tools = typeof rawTools === "string"
      ? rawTools.split(/\n|,/u).map((tool) => tool.trim()).filter(Boolean)
      : rawTools;
    if (!Array.isArray(tools) || tools.some((tool) => typeof tool !== "string")) throw new Error("INVALID_INPUT");
    return { ...createResearchPackManifest(stringInput(rawInput, ["name", "packName"]), tools), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
