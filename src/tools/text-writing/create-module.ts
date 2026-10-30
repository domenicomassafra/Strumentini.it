import type { ToolModule } from "../../runtime/types";

export function createTextWritingModule<T>(run: (input: unknown, signal?: AbortSignal) => T): ToolModule {
  return {
    run(input, _context, signal): T {
      if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
      return run(input, signal);
    },
  };
}

export function requireObjectInput(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  return value as Record<string, unknown>;
}
