import { extractEmailDomains } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const record = value as Record<string, unknown>;
    const source = record.text ?? record.input ?? record.emails;
    if (typeof source !== "string" && !Array.isArray(source)) throw new Error("INVALID_INPUT");
    return extractEmailDomains(source as string | readonly string[]);
  },
};

export default module;
