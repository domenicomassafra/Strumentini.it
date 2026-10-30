import { compareUrls } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

function input(value: unknown): {
  leftUrl: string;
  rightUrl: string;
  mode?: "exact" | "semantic";
  ignoreFragment?: boolean;
  sortQuery?: boolean;
  removeTrailingSlash?: boolean;
  dropTracking?: boolean;
} {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const record = value as Record<string, unknown>;
  const leftUrl = record.leftUrl ?? record.first ?? record.a;
  const rightUrl = record.rightUrl ?? record.second ?? record.b;
  if (typeof leftUrl !== "string" || typeof rightUrl !== "string") throw new Error("INVALID_INPUT");
  if (record.mode !== undefined && record.mode !== "exact" && record.mode !== "semantic") throw new Error("INVALID_COMPARISON_MODE");
  for (const key of ["ignoreFragment", "sortQuery", "removeTrailingSlash", "dropTracking"] as const) {
    if (record[key] !== undefined && typeof record[key] !== "boolean") throw new Error("INVALID_INPUT");
  }
  return {
    leftUrl,
    rightUrl,
    ...(record.mode === undefined ? {} : { mode: record.mode }),
    ...(record.ignoreFragment === undefined ? {} : { ignoreFragment: record.ignoreFragment as boolean }),
    ...(record.sortQuery === undefined ? {} : { sortQuery: record.sortQuery as boolean }),
    ...(record.removeTrailingSlash === undefined ? {} : { removeTrailingSlash: record.removeTrailingSlash as boolean }),
    ...(record.dropTracking === undefined ? {} : { dropTracking: record.dropTracking as boolean }),
  };
}

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const { leftUrl, rightUrl, ...options } = input(value);
    return compareUrls(leftUrl, rightUrl, options);
  },
};

export default module;
