import { catalog } from "../generated/catalog";
import { toolLoaders } from "../generated/tool-loaders";
import type { ToolSummary } from "../catalog/manifest";
import type { ToolModule } from "./types";

export interface ToolRegistry {
  list(): readonly ToolSummary[];
  get(toolId: string): ToolSummary | undefined;
  load(toolId: string, signal?: AbortSignal): Promise<ToolModule>;
}

export function createRegistry(
  summaries: readonly ToolSummary[] = catalog,
  loaders: Readonly<Record<string, () => Promise<{ default: ToolModule }>>> = toolLoaders,
): ToolRegistry {
  const byId = new Map(summaries.map((summary) => [summary.id, summary]));
  const moduleCache = new Map<string, Promise<ToolModule>>();

  return {
    list: () => summaries,
    get: (toolId) => byId.get(toolId),
    async load(toolId, signal) {
      if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
      if (!byId.has(toolId)) throw new Error("NOT_FOUND");
      const loader = loaders[toolId];
      if (loader === undefined) throw new Error("LOAD_FAILED");
      let loading = moduleCache.get(toolId);
      if (loading === undefined) {
        loading = loader().then((loaded) => loaded.default);
        moduleCache.set(toolId, loading);
      }
      let module: ToolModule;
      try {
        module = await loading;
      } catch (error) {
        if (moduleCache.get(toolId) === loading) moduleCache.delete(toolId);
        throw error;
      }
      if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
      return module;
    },
  };
}

export const registry = createRegistry();
