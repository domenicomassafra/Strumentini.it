import { checkSocialLimit } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const record = value as Record<string, unknown>;
    if (typeof record.text !== "string" || typeof record.platform !== "string") throw new Error("INVALID_INPUT");
    if (record.limit !== undefined && (typeof record.limit !== "number" || !Number.isInteger(record.limit) || record.limit < 1)) throw new Error("INVALID_SOCIAL_LIMIT");
    return checkSocialLimit(record.platform, record.text, record.limit);
  },
};

export default module;
