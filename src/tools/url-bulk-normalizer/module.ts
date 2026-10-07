import { normalizeUrlDetails, redactUrlCredentials, URL_MARKETING_ENGINE_VERSION } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

interface RawItem {
  readonly sourceIndex: number;
  readonly sourceRow: number;
  readonly input: string;
  readonly before: string;
  readonly url?: string;
  readonly after?: string;
  readonly changed?: boolean;
  readonly dropped?: readonly string[];
  readonly error?: string;
}

interface SourceUrl {
  readonly sourceIndex: number;
  readonly sourceRow: number;
  readonly value: string;
}

function safeInput(value: string): string {
  return redactUrlCredentials(value);
}

function input(value: unknown): { urls: readonly SourceUrl[]; sortQuery: boolean; removeFragment: boolean; removeTrailingSlash: boolean; dropTracking: boolean } {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const record = value as Record<string, unknown>;
  const source = record.urls ?? record.input ?? record.text;
  let urls: readonly SourceUrl[];
  if (typeof source === "string") {
    urls = source.replace(/\r\n?/gu, "\n").split("\n")
      .map((item, sourceIndex) => ({ sourceIndex, sourceRow: sourceIndex + 1, value: item.trim() }))
      .filter((item) => item.value !== "");
  } else {
    if (!Array.isArray(source) || source.some((item) => typeof item !== "string")) throw new Error("INVALID_INPUT");
    urls = source.map((item, sourceIndex) => ({ sourceIndex, sourceRow: sourceIndex + 1, value: item.trim() }))
      .filter((item) => item.value !== "");
  }
  if (urls.length === 0) throw new Error("INVALID_INPUT");
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
    const results: RawItem[] = parsed.urls.map(({ value: url, sourceIndex, sourceRow }) => {
      const before = safeInput(url);
      try {
        const normalized = normalizeUrlDetails(url, {
          sortQuery: parsed.sortQuery,
          removeFragment: parsed.removeFragment,
          removeTrailingSlash: parsed.removeTrailingSlash,
          dropTracking: parsed.dropTracking,
        });
        return {
          sourceIndex,
          sourceRow,
          input: before,
          before,
          url: normalized.url,
          after: normalized.url,
          changed: normalized.changed,
          dropped: normalized.dropped,
        };
      } catch (error) {
        return {
          sourceIndex,
          sourceRow,
          input: before,
          before,
          error: error instanceof Error ? error.message : "INVALID_URL",
        };
      }
    });
    return {
      results,
      normalizedUrls: results.flatMap((item) => item.url === undefined ? [] : [item.url]),
      count: results.length,
      validCount: results.filter((item) => item.url !== undefined).length,
      errorCount: results.filter((item) => item.error !== undefined).length,
      rules: {
        sortQuery: parsed.sortQuery,
        removeFragment: parsed.removeFragment,
        removeTrailingSlash: parsed.removeTrailingSlash,
        dropTracking: parsed.dropTracking,
      },
      network: "not-used",
      verificationScope: "local-transform-only",
      engineVersion: URL_MARKETING_ENGINE_VERSION,
    };
  },
};

export default module;
