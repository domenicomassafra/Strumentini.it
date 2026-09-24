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

export function requireStringInput(value: unknown, field = "text"): string {
  const input = requireObjectInput(value);
  const fieldValue = input[field];
  if (typeof fieldValue !== "string") throw new Error("INVALID_INPUT");
  return fieldValue;
}
