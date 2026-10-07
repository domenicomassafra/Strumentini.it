import { parseUtmUrl, parseUtmUrlsBulk, UTM_DUPLICATE_POLICY, UTM_ENCODING_POLICY } from "../../engines/campaign-url";
import type { ToolModule } from "../../runtime/types";

function inputUrl(value: unknown): { readonly url: string; readonly bulk: boolean } {
  if (typeof value !== "object" || value === null || typeof (value as { url?: unknown }).url !== "string") throw new Error("INVALID_INPUT");
  const record = value as { url: string; bulk?: unknown };
  if (record.bulk !== undefined && typeof record.bulk !== "boolean") throw new Error("INVALID_INPUT");
  return { url: record.url, bulk: record.bulk === true };
}

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const parsed = inputUrl(value);
    if (parsed.bulk) {
      const urls = parsed.url.replace(/\r\n?/gu, "\n").split("\n").map((entry) => entry.trim()).filter((entry) => entry !== "");
      return parseUtmUrlsBulk(urls);
    }
    return {
      ...parseUtmUrl(parsed.url),
      encodingPolicy: UTM_ENCODING_POLICY,
      duplicatePolicy: UTM_DUPLICATE_POLICY,
    };
  },
};

export default module;
