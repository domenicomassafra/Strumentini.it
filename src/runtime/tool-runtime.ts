import { runtimeToolIndex } from "../generated/runtime-tool-index";
import type { RuntimeToolIndexEntry, ToolSummary } from "../catalog/manifest";
import type { ToolRegistry } from "./registry";
import { resolveToolDefaults, type ProfileResolutionInput } from "./profile";
import type { PreflightResult, RuntimeTelemetryContext, ToolRunResult } from "./types";
import { getTelemetryAdapter, consumeToolEntrySource, consumeToolOpenedMarker } from "../telemetry/browser";
import { trackProfileDefault, trackToolCompleted, trackToolFailed, trackToolOpened } from "../telemetry/events";
import type { TelemetryAdapter } from "../telemetry/adapter";
import { normalizeProfileFieldKey, type ToolFamily } from "../telemetry/schema";

export interface RuntimeContext extends ProfileResolutionInput, RuntimeTelemetryContext {}

const runtimeToolsById = new Map<string, RuntimeToolIndexEntry>(
  runtimeToolIndex.map((tool) => [tool.id, tool]),
);
let defaultRegistryPromise: Promise<ToolRegistry> | undefined;

function loadDefaultRegistry(): Promise<ToolRegistry> {
  defaultRegistryPromise ??= import("./registry").then((module) => module.registry);
  return defaultRegistryPromise;
}

function preflightWithRegistry(toolRegistry: ToolRegistry, toolId: string): PreflightResult {
  const tool = toolRegistry.get(toolId);
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

function toolFamily(category: string): ToolFamily {
  const normalized = category.toLocaleLowerCase();
  if (normalized.includes("csv") || normalized.includes("table") || normalized.includes("data")) return "data";
  if (normalized.includes("pdf") || normalized.includes("document") || normalized.includes("file")) return "document";
  if (normalized.includes("image") || normalized.includes("photo")) return "image";
  if (normalized.includes("research") || normalized.includes("citation")) return "research";
  if (normalized.includes("campaign") || normalized.includes("marketing") || normalized.includes("url")) return "campaign";
  if (normalized.includes("text") || normalized.includes("writing")) return "text";
  if (normalized.includes("date") || normalized.includes("time") || normalized.includes("schedule")) return "time";
  if (normalized.includes("business") || normalized.includes("finance") || normalized.includes("operation")) return "business";
  return "other";
}

function failureCode(code: "INVALID_INPUT" | "CANCELLED" | "RUNTIME_ERROR"): "invalid-input" | "cancelled" | "runtime-error" {
  if (code === "INVALID_INPUT") return "invalid-input";
  if (code === "CANCELLED") return "cancelled";
  return "runtime-error";
}

export function createToolRuntime(
  toolRegistry?: ToolRegistry,
  telemetry?: TelemetryAdapter,
  now: () => number = Date.now,
) {
  const adapter: TelemetryAdapter = telemetry ?? {
    track: (input) => getTelemetryAdapter().track(input),
  };
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
      const preflight = this.preflight(toolId);
      if (!preflight.ok) {
        const subject = context.telemetrySubjectId === undefined ? undefined : { subjectId: context.telemetrySubjectId };
        trackToolFailed(adapter, toolId, "not-found", "other", subject);
        return preflight;
      }

      const entrySource = context.entrySource ?? consumeToolEntrySource(toolId) ?? "public";
      const subject = context.telemetrySubjectId === undefined ? undefined : { subjectId: context.telemetrySubjectId };
      const family = toolFamily(preflight.tool.category);
      if (!consumeToolOpenedMarker(toolId)) trackToolOpened(adapter, toolId, entrySource, subject);
      const startedAt = now();

      if (signal?.aborted) {
        trackToolFailed(adapter, toolId, "cancelled", family, subject);
        return { ok: false, code: "CANCELLED", message: "Operation cancelled" };
      }

      const defaults = resolveToolDefaults(preflight.tool, context);
      const defaultMap = Object.fromEntries(defaults.map((entry) => [entry.field, entry]));
      for (const entry of defaults) {
        const fieldKey = normalizeProfileFieldKey(entry.field);
        if (fieldKey === undefined) continue;
        if (entry.provenance === "profile") trackProfileDefault(adapter, fieldKey, "applied", subject);
        if (entry.provenance === "explicit") trackProfileDefault(adapter, fieldKey, "overridden", subject);
      }

      try {
        const activeRegistry = toolRegistry ?? await loadDefaultRegistry();
        if (signal?.aborted) {
          trackToolFailed(adapter, toolId, "cancelled", family, subject);
          return { ok: false, code: "CANCELLED", message: "Operation cancelled" };
        }
        const fullTool = activeRegistry.get(toolId) as ToolSummary | undefined;
        if (fullTool === undefined) {
          trackToolFailed(adapter, toolId, "not-found", family, subject);
          return { ok: false, code: "NOT_FOUND", message: `Unknown tool: ${toolId}` };
        }
        const module = await activeRegistry.load(toolId, signal);
        const value = await module.run(input, { defaults: defaultMap }, signal);
        trackToolCompleted(adapter, toolId, now() - startedAt, family, subject);
        return { ok: true, tool: fullTool, value, defaults };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          trackToolFailed(adapter, toolId, "cancelled", family, subject);
          return { ok: false, code: "CANCELLED", message: "Operation cancelled" };
        }
        const message = normalizeMessage(error);
        const code = message.startsWith("INVALID_") ? "INVALID_INPUT" : "RUNTIME_ERROR";
        trackToolFailed(adapter, toolId, failureCode(code), family, subject);
        return {
          ok: false,
          code,
          message,
        };
      }
    },
  };
}

export const toolRuntime = createToolRuntime();
