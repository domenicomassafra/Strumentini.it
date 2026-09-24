import { parseUtmUrl } from "../../engines/campaign-url";
import type { ToolModule } from "../../runtime/types";

function inputUrl(value: unknown): string {
  if (typeof value !== "object" || value === null || typeof (value as { url?: unknown }).url !== "string") throw new Error("INVALID_INPUT");
  return (value as { url: string }).url;
}

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    return parseUtmUrl(inputUrl(value));
  },
};

export default module;
