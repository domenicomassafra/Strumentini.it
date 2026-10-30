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

function input(value: unknown): { urls: readonly SourceUrl[]; sortQuery: boolean; removeFragment: boolean; removeTrailingSlash: boolean; dropTracking: boolean } {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const record = value as Record<string, unknown>;
  const source = record.urls ?? record.input ?? record.text;
  const lines = typeof source === "string" ? source.replace(/\r\n?/gu, "\n").split("\n") : source;
  if (!Array.isArray(lines) || lines.some((item) => typeof item !== "string")) throw new Error("INVALID_INPUT");
  const urls: SourceUrl[] = (lines as string[])
    .map((item, sourceIndex) => ({ sourceIndex, sourceRow: sourceIndex + 1, value: item.trim() }))
    .filter((item) => item.value !== "");
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
    const { urls, ...rules } = input(value);
    const results: RawItem[] = urls.map(({ value: url, sourceIndex, sourceRow }) => {
      const before = redactUrlCredentials(url);
      try {
        const normalized = normalizeUrlDetails(url, rules);
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
      rules,
      network: "not-used",
      verificationScope: "local-transform-only",
      engineVersion: URL_MARKETING_ENGINE_VERSION,
    };
  },
};

export default module;
