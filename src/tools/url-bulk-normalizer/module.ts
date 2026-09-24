import { normalizeUrlDetails, URL_MARKETING_ENGINE_VERSION } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

interface RawItem {
  readonly input: string;
  readonly url?: string;
  readonly changed?: boolean;
  readonly dropped?: readonly string[];
  readonly error?: string;
}

function safeInput(value: string): string {
  return value.replace(/(https?:\/\/)[^\s/@]+@/giu, "$1[redacted]@");
}

function input(value: unknown): { urls: readonly string[]; sortQuery: boolean; removeFragment: boolean; removeTrailingSlash: boolean; dropTracking: boolean } {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const record = value as Record<string, unknown>;
  const source = record.urls ?? record.input ?? record.text;
  const urls = typeof source === "string" ? source.split(/\r?\n/u).map((item) => item.trim()).filter((item) => item !== "") : source;
  if (!Array.isArray(urls) || urls.some((item) => typeof item !== "string")) throw new Error("INVALID_INPUT");
  const bool = (key: string, fallback: boolean): boolean => {
    const candidate = record[key];
    if (candidate === undefined) return fallback;
    if (typeof candidate !== "boolean") throw new Error("INVALID_INPUT");
    return candidate;
  };
  return {
    urls,
    sortQuery: bool("sortQuery", true),
    removeFragment: bool("removeFragment", false),
    removeTrailingSlash: bool("removeTrailingSlash", false),
    dropTracking: bool("dropTracking", false),
  };
}

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const parsed = input(value);
    const results: RawItem[] = parsed.urls.map((url) => {
      try {
        const normalized = normalizeUrlDetails(url, {
          sortQuery: parsed.sortQuery,
          removeFragment: parsed.removeFragment,
          removeTrailingSlash: parsed.removeTrailingSlash,
          dropTracking: parsed.dropTracking,
        });
        return { input: safeInput(url), url: normalized.url, changed: normalized.changed, dropped: normalized.dropped };
      } catch (error) {
        return { input: safeInput(url), error: error instanceof Error ? error.message : "INVALID_URL" };
      }
    });
    return {
      results,
      normalizedUrls: results.flatMap((item) => item.url === undefined ? [] : [item.url]),
      count: results.length,
      validCount: results.filter((item) => item.url !== undefined).length,
      errorCount: results.filter((item) => item.error !== undefined).length,
      engineVersion: URL_MARKETING_ENGINE_VERSION,
    };
  },
};

export default module;
