import { formatPdfPageCitation, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { PdfPageCitationInput } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import { modeInput, recordInput, stringInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = recordInput(rawInput);
    const year = input.year;
    if (typeof year !== "string" && typeof year !== "number") throw new Error("INVALID_INPUT");
    const style = modeInput(rawInput, ["style", "format"], ["apa", "mla", "chicago"] as const, "apa");
    const citationInput: PdfPageCitationInput = {
      author: stringInput(rawInput, ["author", "authors"]),
      title: stringInput(rawInput, ["title", "document", "name"]),
      year,
      pages: stringInput(rawInput, ["pages", "page", "pageRange"]),
      style,
      ...(typeof input.document === "string" ? { document: input.document } : {}),
    };
    return { ...formatPdfPageCitation(citationInput), engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION };
  },
};

export default module;
