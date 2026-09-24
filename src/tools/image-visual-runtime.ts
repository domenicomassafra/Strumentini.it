import type { ToolModule } from "../runtime/types";

export function createImageVisualModule(
  run: (input: unknown, signal?: AbortSignal) => unknown | Promise<unknown>,
): ToolModule {
  return {
    run(input, _context, signal) {
      return run(input, signal);
    },
  };
}
