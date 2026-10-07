import { inspectRedirectChain, inspectRedirectChainLive, type RedirectHop } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

function parseHops(value: unknown): readonly RedirectHop[] {
  if (Array.isArray(value)) return value as RedirectHop[];
  if (typeof value !== "string") throw new Error("INVALID_REDIRECT_CHAIN");
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) throw new Error("INVALID_REDIRECT_CHAIN");
      return parsed as RedirectHop[];
    } catch {
      throw new Error("INVALID_REDIRECT_CHAIN");
    }
  }
  return trimmed.split(/\r?\n/u).filter((line) => line.trim() !== "").map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    if (parts.length < 1 || parts[0] === "") throw new Error("INVALID_REDIRECT_CHAIN");
    const status = parts[1] === undefined || parts[1] === "" ? 200 : Number(parts[1]);
    const location = parts[2] === undefined || parts[2] === "" ? null : parts[2];
    const delayMs = parts[3] === undefined || parts[3] === "" ? null : Number(parts[3]);
    return { url: parts[0]!, status, location, delayMs };
  });
}

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const record = value as Record<string, unknown>;
    const mode = record.mode ?? "local";
    if (mode !== "local" && mode !== "live") throw new Error("INVALID_INPUT");
    if (mode === "live") {
      if (typeof record.url !== "string") throw new Error("INVALID_URL");
      const maxHops = record.maxHops ?? 10;
      const timeoutMs = record.timeoutMs ?? 8_000;
      if (typeof maxHops !== "number" || typeof timeoutMs !== "number") throw new Error("INVALID_INPUT");
      return inspectRedirectChainLive(record.url, {
        maxHops,
        timeoutMs,
        ...(signal === undefined ? {} : { signal }),
      });
    }
    const source = record.hops ?? record.steps ?? record.chain ?? record.text;
    return inspectRedirectChain(parseHops(source));
  },
};

export default module;
