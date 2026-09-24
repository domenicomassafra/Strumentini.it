import { compareUrls } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

function input(value: unknown): { leftUrl: string; rightUrl: string; mode?: "exact" | "semantic"; ignoreFragment?: boolean } {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const record = value as Record<string, unknown>;
  const leftUrl = record.leftUrl ?? record.first ?? record.a;
  const rightUrl = record.rightUrl ?? record.second ?? record.b;
  if (typeof leftUrl !== "string" || typeof rightUrl !== "string") throw new Error("INVALID_INPUT");
  if (record.mode !== undefined && record.mode !== "exact" && record.mode !== "semantic") throw new Error("INVALID_COMPARISON_MODE");
  if (record.ignoreFragment !== undefined && typeof record.ignoreFragment !== "boolean") throw new Error("INVALID_INPUT");
  return {
    leftUrl,
    rightUrl,
    ...(record.mode === undefined ? {} : { mode: record.mode }),
    ...(record.ignoreFragment === undefined ? {} : { ignoreFragment: record.ignoreFragment }),
  };
}

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const parsed = input(value);
    return compareUrls(parsed.leftUrl, parsed.rightUrl, {
      ...(parsed.mode === undefined ? {} : { mode: parsed.mode }),
      ...(parsed.ignoreFragment === undefined ? {} : { ignoreFragment: parsed.ignoreFragment }),
    });
  },
};

export default module;
