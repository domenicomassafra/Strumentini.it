import { parseRobots } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null || typeof (value as { text?: unknown }).text !== "string") throw new Error("INVALID_INPUT");
    return parseRobots((value as { text: string }).text);
  },
};

export default module;
