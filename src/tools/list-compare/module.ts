import {
  compareLists,
  dedupeLines,
  parseListText,
  TEXT_LIST_ENGINE_VERSION,
  type EqualityMode,
} from "../../engines/text-list";
import type { ToolModule } from "../../runtime/types";
import type { ListCompareInput, ListCompareOutput } from "./types";

function isEqualityMode(value: unknown): value is EqualityMode {
  return value === "exact" || value === "trim" || value === "nfc" || value === "trim-nfc";
}

function validateInput(value: unknown): ListCompareInput {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const candidate = value as Partial<ListCompareInput>;
  if (typeof candidate.left !== "string" || typeof candidate.right !== "string") throw new Error("INVALID_INPUT");
  if (candidate.equality !== undefined && !isEqualityMode(candidate.equality)) throw new Error("INVALID_INPUT");
  return candidate as ListCompareInput;
}

const module: ToolModule = {
  run(rawInput, _context, signal): ListCompareOutput {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const input = validateInput(rawInput);
    const equality = input.equality ?? "exact";
    const left = parseListText(input.left);
    const right = parseListText(input.right);
    return {
      equality,
      leftDeduped: dedupeLines(left, equality),
      rightDeduped: dedupeLines(right, equality),
      ...compareLists(left, right, equality),
      engineVersion: TEXT_LIST_ENGINE_VERSION,
    };
  },
};

export default module;
