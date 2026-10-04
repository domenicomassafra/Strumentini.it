import { formatBibtexDocument, parseBibtexDocument, RESEARCH_KNOWLEDGE_ENGINE_VERSION } from "../../engines/research-knowledge";
import type { ToolModule } from "../../runtime/types";
import type { BibtexFormatterOutput } from "./types";
import { stringInput } from "../research-knowledge";

const module: ToolModule = {
  run(rawInput, _context, signal): BibtexFormatterOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const document = parseBibtexDocument(stringInput(rawInput, ["text", "bibtex", "input"]));
    const formatted = formatBibtexDocument(document.entries);
    const warnings = [
      ...(document.truncated ? [{ record: 0, code: "BIBTEX_TRUNCATED", message: "Il documento BibTeX contiene una voce non chiusa: il testo leggibile è stato formattato e la parte rimanente no." }] : []),
      ...(document.directives.length > 0
        ? [{ record: 0, code: "BIBTEX_DIRECTIVE_SKIPPED", message: `Le direttive @${[...new Set(document.directives)].sort().join(", @")} non sono voci bibliografiche e non sono state riformattate.` }]
        : []),
      ...formatted.warnings,
    ];
    return {
      bibtex: formatted.bibtex,
      entries: document.entries,
      entryCount: document.entries.length,
      directiveCount: document.directives.length,
      truncated: document.truncated,
      warnings,
      engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION,
    };
  },
};

export default module;
