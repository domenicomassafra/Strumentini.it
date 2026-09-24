import { runtimeToolIndex } from "../generated/runtime-tool-index";
import type { RuntimeToolIndexEntry, ToolSummary } from "../catalog/manifest";
import type { ToolRegistry } from "./registry";
import { resolveToolDefaults, type ProfileResolutionInput } from "./profile";
import type { PreflightResult, ToolRunResult } from "./types";

export interface RuntimeContext extends ProfileResolutionInput {}

const runtimeToolsById = new Map<string, RuntimeToolIndexEntry>(
  runtimeToolIndex.map((tool) => [tool.id, tool]),
);
type RegistryPreflightResult =
  | { ok: true; tool: ToolSummary }
  | { ok: false; code: "NOT_FOUND"; message: string };

let defaultRegistryPromise: Promise<ToolRegistry> | undefined;

function loadDefaultRegistry(): Promise<ToolRegistry> {
  defaultRegistryPromise ??= import("./registry").then((module) => module.registry);
  return defaultRegistryPromise;
}

function preflightWithRegistry(registry: ToolRegistry, toolId: string): RegistryPreflightResult {
  const tool = registry.get(toolId);
  return tool === undefined
    ? { ok: false, code: "NOT_FOUND", message: `Unknown tool: ${toolId}` }
    : { ok: true, tool };
}

function preflightFromIndex(toolId: string): PreflightResult {
  const tool = runtimeToolsById.get(toolId);
  return tool === undefined
    ? { ok: false, code: "NOT_FOUND", message: `Unknown tool: ${toolId}` }
    : { ok: true, tool };
}

function normalizeMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown runtime failure";
}

export function createToolRuntime(toolRegistry?: ToolRegistry) {
  return {
    preflight(toolId: string): PreflightResult {
      return toolRegistry === undefined ? preflightFromIndex(toolId) : preflightWithRegistry(toolRegistry, toolId);
    },

    async run(
      toolId: string,
      input: unknown,
      context: RuntimeContext = {},
      signal?: AbortSignal,
    ): Promise<ToolRunResult> {
      if (signal?.aborted) {
        return { ok: false, code: "CANCELLED", message: "Operation cancelled" };
      }

      try {
        const activeRegistry = toolRegistry ?? await loadDefaultRegistry();
        if (signal?.aborted) {
          return { ok: false, code: "CANCELLED", message: "Operation cancelled" };
        }
        const preflight = preflightWithRegistry(activeRegistry, toolId);
        if (!preflight.ok) return preflight;
        const defaults = resolveToolDefaults(preflight.tool, context);
        const defaultMap = Object.fromEntries(defaults.map((entry) => [entry.field, entry]));
        const module = await activeRegistry.load(toolId, signal);
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
