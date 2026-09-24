import { canonicalUrlDetails } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const record = value as Record<string, unknown>;
    const pageUrl = record.pageUrl ?? record.url;
    const canonicalUrl = record.canonicalUrl ?? record.canonical;
    if (typeof pageUrl !== "string" || typeof canonicalUrl !== "string") throw new Error("INVALID_INPUT");
    if (record.removeFragment !== undefined && typeof record.removeFragment !== "boolean") throw new Error("INVALID_INPUT");
    return canonicalUrlDetails(pageUrl, canonicalUrl, record.removeFragment === undefined ? {} : { removeFragment: record.removeFragment });
  },
};

export default module;
