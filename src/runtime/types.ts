import type { RuntimeToolIndexEntry, ToolSummary } from "../catalog/manifest";

export type DefaultProvenance =
  | "explicit"
  | "profile"
  | "tool-default"
  | "system-derived";

export interface ResolvedDefault {
  field: string;
  value: unknown;
  provenance: DefaultProvenance;
}

export interface ToolExecutionContext {
  defaults: Readonly<Record<string, ResolvedDefault>>;
}

export interface ToolModule {
  run(
    input: unknown,
    context: ToolExecutionContext,
    signal?: AbortSignal,
  ): Promise<unknown> | unknown;
}

export type ToolRunResult =
  | {
      ok: true;
      tool: ToolSummary;
      value: unknown;
      defaults: readonly ResolvedDefault[];
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "INVALID_INPUT" | "CANCELLED" | "RUNTIME_ERROR";
      message: string;
    };

export type PreflightResult =
  | { ok: true; tool: RuntimeToolIndexEntry }
  | { ok: false; code: "NOT_FOUND"; message: string };
