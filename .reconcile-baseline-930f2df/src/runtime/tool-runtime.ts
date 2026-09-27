import { registry, type ToolRegistry } from "./registry";
import { resolveToolDefaults, type ProfileResolutionInput } from "./profile";
import type { PreflightResult, ToolRunResult } from "./types";

export interface RuntimeContext extends ProfileResolutionInput {}

function normalizeMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown runtime failure";
}

export function createToolRuntime(toolRegistry: ToolRegistry = registry) {
  return {
    preflight(toolId: string): PreflightResult {
      const tool = toolRegistry.get(toolId);
      return tool === undefined
        ? { ok: false, code: "NOT_FOUND", message: `Unknown tool: ${toolId}` }
        : { ok: true, tool };
    },

    async run(
      toolId: string,
      input: unknown,
      context: RuntimeContext = {},
      signal?: AbortSignal,
    ): Promise<ToolRunResult> {
      const preflight = this.preflight(toolId);
      if (!preflight.ok) return preflight;

      if (signal?.aborted) {
        return { ok: false, code: "CANCELLED", message: "Operation cancelled" };
      }

      const defaults = resolveToolDefaults(preflight.tool, context);
      const defaultMap = Object.fromEntries(defaults.map((entry) => [entry.field, entry]));

      try {
        const module = await toolRegistry.load(toolId, signal);
        const value = await module.run(input, { defaults: defaultMap }, signal);
        return { ok: true, tool: preflight.tool, value, defaults };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return { ok: false, code: "CANCELLED", message: "Operation cancelled" };
        }
        const message = normalizeMessage(error);
        return {
          ok: false,
          code: message.startsWith("INVALID_") ? "INVALID_INPUT" : "RUNTIME_ERROR",
          message,
        };
      }
    },
  };
}

export const toolRuntime = createToolRuntime();
