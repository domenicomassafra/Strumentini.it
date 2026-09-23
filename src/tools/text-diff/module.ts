import { diffText, TEXT_LIST_ENGINE_VERSION } from "../../engines/text-list";
import type { ToolModule } from "../../runtime/types";
import type { TextDiffInput, TextDiffOutput } from "./types";

function validateInput(value: unknown): TextDiffInput {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const candidate = value as Partial<TextDiffInput>;
  if (typeof candidate.before !== "string" || typeof candidate.after !== "string") throw new Error("INVALID_INPUT");
  return candidate as TextDiffInput;
}

const module: ToolModule = {
  run(rawInput, _context, signal): TextDiffOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = validateInput(rawInput);
    try {
      const operations = diffText(input.before, input.after);
      return {
        operations,
        additions: operations.filter(({ kind }) => kind === "add").length,
        removals: operations.filter(({ kind }) => kind === "remove").length,
        unchanged: operations.filter(({ kind }) => kind === "equal").length,
        engineVersion: TEXT_LIST_ENGINE_VERSION,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "DIFF_TOO_LARGE") {
        throw new Error("INVALID_DIFF_TOO_LARGE");
      }
      throw error;
    }
  },
};

export default module;
