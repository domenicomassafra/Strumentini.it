import { generateSitemapXml } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("INVALID_SITEMAP_INPUT");
    const record = value as Record<string, unknown>;
    const text = record.text ?? record.input ?? record.urls;
    if (typeof text !== "string") throw new Error("INVALID_SITEMAP_INPUT");
    return generateSitemapXml(text);
  },
};

export default module;
